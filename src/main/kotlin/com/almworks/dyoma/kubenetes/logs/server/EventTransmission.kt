package com.almworks.dyoma.kubenetes.logs.server

import com.almworks.dyoma.kubenetes.logs.core.PodEvent
import com.almworks.dyoma.kubenetes.logs.core.PodInfo
import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.core.*
import com.fasterxml.jackson.databind.SerializationFeature
import java.io.InputStream
import java.io.OutputStream

/**
 * Implements event persistence protocol.
 * * The protocol is a JSON array of objects, each object is either a [PodInfo] or [PodEvent.Parsed].
 * * POD infos comes before events and are referenced by their ID in events.
 * @see receiveEvents for reading the protocol
 */
class EventSender(private val gen: JsonGenerator) {
  companion object {
    fun toStream(stream: OutputStream): EventSender {
      val gen = mapper.createGenerator(stream)
      gen.writeStartArray()
      return EventSender(gen)
    }

    fun toStream(stream: OutputStream, block: (EventSender) -> Unit) {
      val sender = toStream(stream)
      try {
        block(sender)
      } finally {
        sender.finish()
      }
    }
  }

  private val sentPods = mutableMapOf<String, Int>()

  fun send(event: PodEvent.Parsed) {
    val podId: Int = sentPods[event.pod.runId] ?: sentPods.size.also { newId ->
      val pod = event.pod
      sentPods[pod.runId] = newId
      EventSchema.Pod.write(gen, newId, pod)
    }
    EventSchema.Event.write(gen, podId, event)
  }

  fun finish() {
    gen.writeEndArray()
    gen.flush()
  }
}

fun receiveEvents(stream: InputStream) = receiveEvents(mapper.createParser(stream))

fun receiveEvents(parser: JsonParser) = sequence {
  val idToPod = mutableMapOf<Int, PodInfo>()
  if (parser.nextToken() != JsonToken.START_ARRAY)
    throw IllegalStateException("Expected array")
  while (parser.nextToken() != JsonToken.END_ARRAY) {
    when (val next = EventSchema.readNext(parser, idToPod)) {
      is EventSchema.Pod -> idToPod[next.id] = next.pod
      is EventSchema.Event -> yield(next.event)
    }
  }
}

private val mapper = createObjectMapper()
  .setSerializationInclusion(JsonInclude.Include.NON_NULL)
  .disable(SerializationFeature.WRITE_DATE_TIMESTAMPS_AS_NANOSECONDS)
