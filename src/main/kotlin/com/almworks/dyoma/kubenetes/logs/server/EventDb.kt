package com.almworks.dyoma.kubenetes.logs.server

import java.time.Instant
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

class EventDb {
  private val bySid = BySid()
  private val byTime = ByTime()

  fun receiveEvent(event: PodEvent<*>) {
    if (event is PodEvent.Parsed) {
      bySid.add(event)
      byTime.add(event)
    }
  }

  fun searchEvent(fromSid: Long?, fromTime: Instant?, collector: (PodEvent.Parsed) -> Unit) {
    val fromMillis = fromTime?.toEpochMilli()
    if (fromSid != null || fromMillis == null) {
      bySid.retrieve(fromSid ?: 0) {
        if (fromMillis == null || fromMillis <= it.time) collector(it)
      }
    } else {
      byTime.retrieve(fromMillis, collector)
    }
  }

  private abstract class Index {
    private val dataLock = ReentrantReadWriteLock()
    private val data = mutableListOf<PodEvent.Parsed>()
    private val newLock = Object()
    private val newEvents = mutableListOf<PodEvent.Parsed>()

    fun add(event: PodEvent.Parsed) {
      synchronized(newLock) {
        newEvents.add(event)
      }
    }

    fun retrieve(fromSid: Long, collector: (PodEvent.Parsed) -> Unit) {
      processNew()
      dataLock.read {
        var index = data.binarySearchBy(fromSid) { it.sid }
        if (index < 0) index = -index - 1
        while (index < data.size) {
          collector(data[index++])
        }
      }
    }

    private fun processNew() {
      val newCopy = synchronized(newLock) {
        if (newEvents.isEmpty()) return
        val copy = ArrayList(newEvents)
        newEvents.clear()
        copy
      }
      dataLock.write {
        addNew(data, newCopy)
      }
    }

    protected abstract fun addNew(data: MutableList<PodEvent.Parsed>, newCopy: List<PodEvent.Parsed>)
  }

  private class BySid: Index() {
    override fun addNew(data: MutableList<PodEvent.Parsed>, newCopy: List<PodEvent.Parsed>) {
      data.addAll(newCopy)
    }
  }

  private class ByTime: Index() {
    override fun addNew(data: MutableList<PodEvent.Parsed>, newCopy: List<PodEvent.Parsed>) {
      data.addAll(newCopy)
      data.sortBy { it.time }
    }
  }
}