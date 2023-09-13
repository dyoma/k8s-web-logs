package com.almworks.dyoma.kubenetes.logs.core

import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

class PodLogsLoader {
  private val eventChannel = Channel<ReceivedPodEvent>(Channel.UNLIMITED)
  private val logLoaders = ConcurrentHashMap<String, Job>()
  private var readJob = AtomicReference<Job?>(null)
  private val totalOrder = EventTotalOrder()
  private val log = LoggerFactory.getLogger(PodLogsLoader::class.java)

  @OptIn(DelicateCoroutinesApi::class)
  fun start(collect: suspend (PodEvent<*>) -> Unit) {
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
          while (true) {
            collect(totalOrder.assignSid(eventChannel.receive()))
          }
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

  @OptIn(DelicateCoroutinesApi::class)
  fun loadLogs(pod: Pod) {
    while (true) {
      val prevJob = logLoaders[pod.runId]
      if (prevJob != null) {
        if (prevJob.isActive) return
        logLoaders.remove(pod.runId, prevJob)
        continue
      }
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
    try {
      val logsStream = pod.streamLog(timestamp = false)
      ReceivedPodEvent.parsePodEventStream(podInfo, logsStream, eventChannel::send)
      log.warn("Log finished for POD: {}", pod.runId)
    } catch (e: Exception) {
      log.warn("Failed to load logs from {}", pod.runId, e)
    }
  }
}