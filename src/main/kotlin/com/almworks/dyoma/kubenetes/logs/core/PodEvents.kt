package com.almworks.dyoma.kubenetes.logs.core

import com.almworks.dyoma.kubenetes.logs.server.createObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue
import java.io.InputStream
import java.time.Instant

// This file defines basic data schema of log events

/**
 * Basic info about a POD
 */
data class PodInfo(
  val name: String,
  val startedAt: Instant
) {
  private var _runId: String? = null

  val runId: String get() = _runId ?: "$name=${startedAt.toEpochMilli()}".also { _runId = it }
}

/**
 * Represents raw log record as it arrives from k8s API but with source POD ([ReceivedPodEvent.pod])
 */
sealed class ReceivedPodEvent {
  abstract val pod: PodInfo
  /** Represents unparsed raw text record. This is the default representation when record parser fails. */
  data class Raw(override val pod: PodInfo, val text: String): ReceivedPodEvent()
  /** Represents parsed JSON record */
  data class Parsed(override val pod: PodInfo, val data: MutableMap<String, Any>, val original: String): ReceivedPodEvent()

  companion object {
    private val k8sMapper = createObjectMapper()

    suspend fun parsePodEventStream(podInfo: PodInfo, logsStream: InputStream, collect: suspend (event: ReceivedPodEvent) -> Unit) {
      logsStream.reader().useLines { lineSequence ->
        val iterator = lineSequence.iterator()
        while (iterator.hasNext()) {
          val line = iterator.next()
          val event = if (line.startsWith("{")) {
            Parsed(podInfo, k8sMapper.readValue<HashMap<String, Any>>(line), line)
          } else {
            Raw(podInfo, line)
          }
          collect(event)
        }
      }
    }
  }
}

/**
 * Represents log record with [sid] assigned, SID defines strict total order on all records.
 */
sealed class PodEvent<T> {
  abstract val pod: PodInfo

  /**
   * Sequential IDentifier. Every log record (regardless of the source POD) has a unique SID number.
   * The SID numbers grows - if a record arrives later that another the "newer" record has greater SID.
   *
   * Note, the "newer" here means "received later".
   * A "newer" record may have an earlier timestamp than a record arrived from a different POD.
   *
   * The purpose of the SID number is to establish a strict total order on all records from all PODs.
   * The total order enables to identify "newer" records - records those arrive after certain point of record
   * processing. For example, a Web app may request "new" records from server - the record it has not seen yet.
   */
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

/**
 * Converts [ReceivedPodEvent] to [PodEvent].
 * The most important part is assignment of [PodEvent.sid], thus establishing total order.
 * Also, it replaces `@timestamp` field with more convenient [PodEvent.Parsed.time]
 */
class EventTotalOrder {
  private var nextSid: Long = 0

  fun assignSid(src: ReceivedPodEvent): PodEvent<*> {
    val sid = nextSid++
    return when (src) {
      is ReceivedPodEvent.Parsed -> {
        val timestamp = src.data.remove("@timestamp")
        if (timestamp !is String) {
          PodEvent.Raw(src.pod, sid, src.original)
        } else {
          val time = Instant.parse(timestamp)
          PodEvent.Parsed(src.pod, sid, time.toEpochMilli(), src.data)
        }
      }
      is ReceivedPodEvent.Raw -> PodEvent.Raw(src.pod, sid, src.text)
    }
  }
}
