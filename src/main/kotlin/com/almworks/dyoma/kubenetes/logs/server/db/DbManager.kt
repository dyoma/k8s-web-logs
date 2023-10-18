package com.almworks.dyoma.kubenetes.logs.server.db

import com.almworks.dyoma.kubenetes.logs.core.PodEvent
import org.slf4j.LoggerFactory
import java.io.File
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

class EventSearch(val fromSid: Long?, val fromTime: Instant?) {
  fun matches(event: PodEvent.Parsed): Boolean {
    val fromMillis = fromTime?.toEpochMilli()
    if (fromSid != null && event.sid < fromSid) return false
    if (fromMillis != null && event.time < fromMillis) return false
    return true
  }

  fun sendMatchingTo(collector: (PodEvent.Parsed) -> Unit): (PodEvent.Parsed) -> Unit = {
    if (matches(it)) collector(it)
  }
}

interface Generation {
  fun searchEvent(query: EventSearch, collector: (PodEvent.Parsed) -> Unit)
}

private const val MAX_MEMORY_GENERATION = 7000

class DbManager(root: File) {
  private val log = LoggerFactory.getLogger(DbManager::class.java)
  private val state = AtomicReference<Generations>()

  init {
    if (!root.exists()) root.mkdirs()
    if (!root.isDirectory) throw IllegalArgumentException("Not a directory: $root")
    state.set(Generations(MemoryGeneration(), MemoryGeneration(), emptyList(), DiskGeneration.loadFiles(root)))
  }

  fun searchEvent(query: EventSearch, collector: (PodEvent.Parsed) -> Unit) {
    state.get().forEachGeneration { it.searchEvent(query, collector) }
  }

  fun receiveEvent(event: PodEvent<*>) {
    while (true) {
      val generations = state.get()
      val size = generations.first.receiveEvent(event)
      if (size < 0) continue
      if (size > MAX_MEMORY_GENERATION) retireFirstGeneration()
      break
    }
  }

  private fun retireFirstGeneration() {
    while (true) {
      val current = state.get()
      val update = current.retireFirst()
      if (state.compareAndSet(current, update)) {
        update.justRetired.deactivate()
        log.info("Generations updated: {}", update.getDebugInfo())
        break
      }
    }
  }
}

private data class Generations(val first: MemoryGeneration, val justRetired: MemoryGeneration, val retired: List<MemoryGeneration>, val disk: DiskGeneration) {
  fun retireFirst() = Generations(MemoryGeneration(), first, retired + justRetired, disk)

  fun getDebugInfo(): String {
    val totalRetired = retired.sumOf { it.size }
    return "[justRetired:${justRetired.size}, totalRetired: $totalRetired/${retired.size}]"
  }

  fun forEachGeneration(block: (Generation) -> Unit) {
    block(first)
    block(justRetired)
    retired.forEach(block)
    block(disk)
  }
}