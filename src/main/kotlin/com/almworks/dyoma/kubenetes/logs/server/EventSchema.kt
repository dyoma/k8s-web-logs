package com.almworks.dyoma.kubenetes.logs.server

import com.almworks.dyoma.kubenetes.logs.core.*
import com.fasterxml.jackson.core.*

object EventSchema {
  private val TYPE = JsonField("type", JsonFieldType.STRING)

  sealed class Restored

  data class Pod(val id: Int, val pod: PodInfo): Restored() {
    companion object {
      internal const val T_POD = "pod"
      internal val NAME = JsonField("name", JsonFieldType.STRING)
      internal val ID = JsonField("id", JsonFieldType.INT)
      internal val STARTED_AT = JsonField("startedAt", JsonFieldType.INSTANT_LONG)

      fun write(gen: JsonGenerator, id: Int, pod: PodInfo) {
        gen.composeObject {
          TYPE.write(gen, T_POD)
          ID.write(gen, id)
          NAME.write(gen, pod.name)
          STARTED_AT.write(gen, pod.startedAt)
        }
      }

      fun fromMap(data: Map<String, Any>): Pod {
        val name = NAME.fromMap(data)
        val startedAt = STARTED_AT.fromMap(data)
        val id = ID.fromMap(data)
        return Pod(id, PodInfo(name, startedAt))
      }
    }
  }

  data class Event(val event: PodEvent.Parsed): Restored() {
    companion object {
      private val MAP_JSON_TYPE = JsonFieldType.obj<Map<String, Any>> { data -> data }
      internal const val T_EVENT = "event"
      internal val SID = JsonField("sid", JsonFieldType.LONG)
      internal val POD_ID = JsonField("pod", JsonFieldType.INT)
      internal val TIME = JsonField("time", JsonFieldType.LONG)
      internal val DATA = JsonField("data", MAP_JSON_TYPE)

      fun write(gen: JsonGenerator, podId: Int, event: PodEvent.Parsed) {
        gen.composeObject {
          TYPE.write(gen, T_EVENT)
          POD_ID.write(gen, podId)
          SID.write(gen, event.sid)
          TIME.write(gen, event.time)
          DATA.write(gen, event.data)
        }
      }

      fun fromMap(data: Map<String, Any>, pods: Map<Int, PodInfo>): Event {
        val podId = POD_ID.fromMap(data)
        val sid = SID.fromMap(data)
        val time = TIME.fromMap(data)
        val eventData = DATA.fromMap(data)
        val pod = pods[podId] ?: throw IllegalArgumentException("Unknown pod ID $podId")
        return Event(PodEvent.Parsed(pod, sid, time, eventData))
      }
    }
  }

  private val SCHEMA = JsonField.toObjSchema(TYPE,
    Pod.ID, Pod.NAME, Pod.STARTED_AT,
    Event.POD_ID, Event.SID, Event.TIME, Event.DATA)

  fun readNext(parser: JsonParser, pods: Map<Int, PodInfo>): Restored {
    val data = JsonFieldType.readValues(parser, SCHEMA)
    return when (TYPE.fromMap(data)) {
      Pod.T_POD -> Pod.fromMap(data)
      Event.T_EVENT -> Event.fromMap(data, pods)
      else -> throw IllegalArgumentException("Unknown event type")
    }
  }
}