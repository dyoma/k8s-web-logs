package com.almworks.dyoma.kubenetes.logs.server

import com.almworks.dyoma.kubenetes.logs.Pod
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.*
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import org.slf4j.LoggerFactory
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicReference

fun createObjectMapper(): ObjectMapper = ObjectMapper()
  .registerModule(JavaTimeModule())
  .registerModule(kotlinModule { enable(KotlinFeature.SingletonSupport) })

data class PodInfo(
  val name: String,
  val startedAt: Instant
)

private sealed class ReceivedPodEvent {
  abstract val pod: PodInfo
  data class Raw(override val pod: PodInfo, val text: String): ReceivedPodEvent()
  data class Parsed(override val pod: PodInfo, val data: MutableMap<String, Any>, val original: String): ReceivedPodEvent()
}

sealed class PodEvent<T> {
  abstract val pod: PodInfo
  abstract val sid: Long
  abstract val data: T

  data class Raw(
    override val pod: PodInfo,
    override val sid: Long,
    override val data: String
  ): PodEvent<String>()

  data class Parsed(
    override val pod: PodInfo,
    override val sid: Long,
    val time: Long,
    override val data: Map<String, Any>
  ): PodEvent<Map<String, Any>>()
}

class LogExtractor {
  private val mapper = createObjectMapper()
  private val eventChannel = Channel<ReceivedPodEvent>(Channel.UNLIMITED)
  private val logLoaders = ConcurrentHashMap<String, Job>()
  private var readJob = AtomicReference<Job?>(null)
  private var nextSid: Long = 0
  private val log = LoggerFactory.getLogger(LogExtractor::class.java)

  @OptIn(DelicateCoroutinesApi::class)
  fun start(receiver: suspend (PodEvent<*>) -> Unit) {
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
          runProcessEvents(receiver)
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

  private suspend fun runProcessEvents(receiver: suspend (PodEvent<*>) -> Unit) {
    while (true) {
      val event = eventChannel.receive()
      val sid = nextSid++
      val processed = when (event) {
        is ReceivedPodEvent.Parsed -> {
          val timestamp = event.data.remove("@timestamp")
          if (timestamp !is String) {
            PodEvent.Raw(event.pod, sid, event.original)
          } else {
            val time = Instant.parse(timestamp)
            PodEvent.Parsed(event.pod, sid, time.toEpochMilli(), event.data)
          }
        }
        is ReceivedPodEvent.Raw -> PodEvent.Raw(event.pod, sid, event.text)
      }
      receiver(processed)
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
      pod.streamLog(timestamp = false).reader().useLines { lineSequence ->
        val iterator = lineSequence.iterator()
        while (iterator.hasNext()) {
          val line = iterator.next()
          val event = if (line.startsWith("{")) {
            ReceivedPodEvent.Parsed(podInfo, mapper.readValue<HashMap<String, Any>>(line), line)
          } else {
            ReceivedPodEvent.Raw(podInfo, line)
          }
          eventChannel.send(event)
        }
      }
    } catch (e: Exception) {
      log.warn("Failed to load logs from {}", pod.runId, e)
    }
  }
}