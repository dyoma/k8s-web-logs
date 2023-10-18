package com.almworks.dyoma.kubenetes.logs.core

import io.kubernetes.client.openapi.ApiException
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import org.slf4j.LoggerFactory
import java.time.Duration
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

class JobHolder {
  private val readJob = AtomicReference<Job?>(null)

  @OptIn(DelicateCoroutinesApi::class)
  fun ensureStarted(jobBlock: suspend CoroutineScope.() -> Unit) {
    while (true) {
      val prev = readJob.get()
      if (prev != null) {
        if (prev.isActive) return
        readJob.compareAndSet(prev, null)
        continue
      }
      var newJob: Job? = null
      newJob = GlobalScope.launch(Dispatchers.Default, CoroutineStart.LAZY) {
        try {
          jobBlock()
        } finally {
          readJob.compareAndSet(newJob, null)
        }
      }
      if (readJob.compareAndSet(null, newJob)) {
        newJob.start()
        break
      } else newJob.cancel()
    }
  }
}

/**
 * Ignore POD if it has started long ago and still no logs are available
 */
private val IGNORE_POD_TIMEOUT = Duration.ofMinutes(5)

/**
 * Retry loading logs after failure. This is needed because sometimes PODs are not ready to stream logs.
 * This applies until the POD gets [old enough][IGNORE_POD_TIMEOUT]
 */
private val RETRY_GET_LOGS = Duration.ofSeconds(3)

class PodLogsLoader {
  private val eventChannel = Channel<ReceivedPodEvent>(Channel.UNLIMITED)
  private val logLoaders = ConcurrentHashMap<String, Job>()
  /**
   * Remember that logs aren't available from some PODs
   */
  private val ignorePods = ConcurrentHashMap<String, String>()
  private val readJob = JobHolder()
  private val totalOrder = EventTotalOrder()
  private val log = LoggerFactory.getLogger(PodLogsLoader::class.java)

  fun start(collect: suspend (PodEvent<*>) -> Unit) {
    readJob.ensureStarted {
      while (true) {
        collect(totalOrder.assignSid(eventChannel.receive()))
      }
    }
  }

  @OptIn(DelicateCoroutinesApi::class)
  fun loadLogs(pod: Pod) {
    while (true) {
      val prevJob = logLoaders[pod.runId]
      if (prevJob != null) {
        if (prevJob.isActive) return
        logLoaders.remove(pod.runId, prevJob)
        continue
      }
      if (ignorePods.containsKey(pod.runId))
        return
      var newJob: Job? = null
      newJob = GlobalScope.launch(Dispatchers.IO, CoroutineStart.LAZY) {
        try {
          runLoad(pod)
        } finally {
          logLoaders.remove(pod.runId, newJob)
        }
      }
      if (logLoaders.putIfAbsent(pod.runId, newJob) == null) {
        newJob.start()
        return
      } else newJob.cancel()
    }
  }

  private suspend fun runLoad(pod: Pod) {
    val podInfo = PodInfo(pod.name, pod.startedAt)
    while (true) {
      try {
        val logsStream = pod.streamLog(timestamp = false)
        log.info("Receiving log from POD: {}", pod.runId)
        ReceivedPodEvent.parsePodEventStream(podInfo, logsStream, eventChannel::send)
        log.warn("Log finished for POD: {}", pod.runId)
      } catch (e: ApiException) {
        if (e.code == 400) {
          if (Instant.now().minus(IGNORE_POD_TIMEOUT).isBefore(pod.startedAt)) {
            delay(RETRY_GET_LOGS.toMillis())
            continue
          }
          ignorePods[pod.runId] = e.message ?: "Exception"
          log.warn("Ignoring logs from {}", pod.runId)
        } else {
          log.warn("Failed to load logs from {}", pod.runId, e)
        }
      } catch (e: Exception) {
        log.warn("Failed to load logs from {}", pod.runId, e)
      }
      return
    }
  }
}