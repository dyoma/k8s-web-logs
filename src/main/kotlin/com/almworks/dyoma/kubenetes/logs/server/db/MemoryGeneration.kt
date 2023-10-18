package com.almworks.dyoma.kubenetes.logs.server.db

import com.almworks.dyoma.kubenetes.logs.core.PodEvent
import java.util.concurrent.locks.ReentrantReadWriteLock
import kotlin.concurrent.read
import kotlin.concurrent.write

/**
 * Lifecycle:
 * 1. Initially its active: receives events.
 * 2. Deactivated: may receive events in case of race condition, but nothing wrong happens.
 * 3. Terminated: cannot receive events.
 *
 * Usage:
 * * Collect all events until it's get full.
 * * Keep it for a while in case new events arrive.
 * * Terminate and write to disk.
 */
internal class MemoryGeneration: Generation {
  private val bySid = BySid()
  private val byTime = ByTime()
  @Volatile
  private var active = true
  private var terminated = false

  /**
   * @return number of events collected or -1 if the instance is inactive and the event hasn't been accepted
   */
  fun receiveEvent(event: PodEvent<*>): Int {
    if (!active) return -1
    if (terminated) throw IllegalStateException("Generation is terminated")
    if (event is PodEvent.Parsed) {
      bySid.add(event)
      return byTime.add(event)
    }
    return size
  }

  val size get() = byTime.size

  fun deactivate() {
    active = false
  }

  fun terminate() {
    terminated = true
  }

  override fun searchEvent(query: EventSearch, collector: (PodEvent.Parsed) -> Unit) {
    val fromMillis = query.fromTime?.toEpochMilli()
    if (query.fromSid != null || fromMillis == null) {
      bySid.retrieve(query.fromSid ?: 0, query.sendMatchingTo(collector))
    } else {
      byTime.retrieve(fromMillis, query.sendMatchingTo(collector))
    }
  }

  private abstract class Index {
    private val dataLock = ReentrantReadWriteLock()
    private val data = mutableListOf<PodEvent.Parsed>()
    private val newLock = Object()
    private val newEvents = mutableListOf<PodEvent.Parsed>()
    @Volatile
    private var _size = 0

    fun add(event: PodEvent.Parsed): Int {
      synchronized(newLock) {
        newEvents.add(event)
        _size++
        return _size
      }
    }

    val size: Int get() = _size

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