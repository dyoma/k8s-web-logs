package com.almworks.dyoma.kubenetes.logs.server

import com.almworks.dyoma.kubenetes.logs.core.PodInfo
import com.almworks.dyoma.kubenetes.logs.core.createObjectMapper
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.databind.SerializationFeature
import java.io.OutputStream
import java.time.Instant

private fun JsonGenerator.composeObject(block: JsonGenerator.() -> Unit) {
  writeStartObject()
  block()
  writeEndObject()
}

internal class SendEvents(private val db: EventDb) {
  private val mapper = createObjectMapper()
    .setSerializationInclusion(JsonInclude.Include.NON_NULL)
    .disable(SerializationFeature.WRITE_DATE_TIMESTAMPS_AS_NANOSECONDS)

  fun send(sid: Long?, time: Instant?, stream: OutputStream) {
    mapper.createGenerator(stream).use { gen ->
      val sentPods = mutableMapOf<PodInfo, Int>()
      gen.writeStartArray()
      db.searchEvent(sid, time) { event ->
        val podId: Int = sentPods[event.pod] ?: sentPods.size.also { newId ->
          val pod = event.pod
          sentPods[pod] = newId
          gen.composeObject {
            writeStringField("type", "pod")
            writeNumberField("id", newId)
            writeStringField("name", pod.name)
            writeNumberField("startedAt", pod.startedAt.toEpochMilli())
          }
        }
        gen.composeObject {
          writeStringField("type", "event")
          writeNumberField("sid", event.sid)
          writeNumberField("time", event.time)
          writeNumberField("pod", podId)
          writeObjectField("data", event.data)
        }
      }
      gen.writeEndArray()
    }
  }
}