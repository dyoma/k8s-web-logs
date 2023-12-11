package com.almworks.dyoma.kubenetes.logs.server.db

import com.almworks.dyoma.kubenetes.logs.core.PodEvent
import org.slf4j.LoggerFactory
import java.io.File
import java.time.Duration
import java.time.Instant
import java.util.concurrent.atomic.AtomicReference

class EventSearch(val fromSid: Long?, val fromTime: Instant?) {
  companion object {
    val EVERYTHING = EventSearch(null, null)
  }
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

/** When [size][MemoryGeneration.size] reaches this limit, it gets retired */
private const val MAX_MEMORY_GENERATION = 7000
/** Minimal time to keep [MemoryGeneration] in retired state before writing to disk */
private val MIN_RETIREMENT = Duration.ofSeconds(1)

class DbManager(private val root: File) {
  private val log = LoggerFactory.getLogger(DbManager::class.java)
  private val state = AtomicReference<Generations>()

  init {
    if (!root.exists()) root.mkdirs()
    if (!root.isDirectory) throw IllegalArgumentException("Not a directory: $root")
    root.listFiles()?.forEach { it.delete() }
    state.set(Generations(MemoryGeneration(), MemoryGeneration(), emptyList(), null, DiskGeneration.loadFiles(root)))
  }

  fun searchEvent(query: EventSearch, collector: (PodEvent.Parsed) -> Unit) {
    try {
      state.get().forEachGeneration { it.searchEvent(query, collector) }
    } catch (e: Exception) {
      log.error("Search failed", e)
    }
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
        update.justRetired.retire()
        log.info("MemGen retired: {}", update.getDebugInfo())
        break
      }
    }
    maybeWriteToDisk()
  }

  private fun maybeWriteToDisk() {
    maybeFinishWrite()
    while (true) {
      val current = state.get()
      val readyToWrite = Instant.now().minus(MIN_RETIREMENT) // Retired before can be written
      val toWrite = current.retired.filter { it.retired?.isBefore(readyToWrite) ?: false }
      if (toWrite.isEmpty() || current.write != null) break
      val writeGeneration = WriteGeneration(toWrite, root, this::maybeFinishWrite)
      val update = current.writeRetired(writeGeneration)
      if (state.compareAndSet(current, update)) {
        writeGeneration.startWrite()
        log.info("Write started: {}", update.getDebugInfo())
        break
      }
    }
  }

  private fun maybeFinishWrite() {
    while (true) {
      val current = state.get()
      if (current.write == null) break
      val writtenFile = current.write.getWrittenFile() ?: break
      val update = current.addWrittenFile(writtenFile)
      if (state.compareAndSet(current, update)) {
        log.info("Write completed: {}", update.getDebugInfo())
        break
      }
    }
  }
}

private data class Generations(
  val first: MemoryGeneration,
  val justRetired: MemoryGeneration,
  val retired: List<MemoryGeneration>,
  val write: WriteGeneration?,
  val disk: DiskGeneration
) {
  fun retireFirst(): Generations {
    val updatedRetired = if (justRetired.size > 0) retired + justRetired
    else retired
    return Generations(MemoryGeneration(), first, updatedRetired, write, disk)
  }

  fun getDebugInfo(): String {
    val totalRetired = retired.sumOf { it.size }
    val writeState = write?.let { "${it.totalEvents}" } ?: "none"
    return "[justRetired:${justRetired.size}, totalRetired: $totalRetired/${retired.size}, write: $writeState, files: ${disk.fileCount}]"
  }

  fun forEachGeneration(block: (Generation) -> Unit) {
    block(first)
    block(justRetired)
    retired.forEach(block)
    write?.let(block)
    block(disk)
  }

  fun writeRetired(writeGeneration: WriteGeneration): Generations {
    val keepRetired = retired.filter { !writeGeneration.contains(it) }
    if (keepRetired.size == retired.size) throw IllegalStateException("No retired generations to write")
    if (write != null) throw IllegalStateException("Write generation already exists")
    return Generations(first, justRetired, emptyList(), writeGeneration, disk)
  }

  fun addWrittenFile(writtenFile: File): Generations {
    if (write == null) throw IllegalStateException("No write generation")
    if (write.getWrittenFile() != writtenFile) throw IllegalStateException("Unexpected written file")
    return Generations(first, justRetired, retired, null, disk.withFile(writtenFile))
  }
}