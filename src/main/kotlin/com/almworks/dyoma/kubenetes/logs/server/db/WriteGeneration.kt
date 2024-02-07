package com.almworks.dyoma.kubenetes.logs.server.db

import com.almworks.dyoma.kubenetes.logs.core.JobHolder
import com.almworks.dyoma.kubenetes.logs.core.PodEvent
import com.almworks.dyoma.kubenetes.logs.server.EventSender
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import kotlin.math.max

internal class WriteGeneration(
  private val memory: List<MemoryGeneration>,
  private val root: File,
  private val completeCallback: () -> Unit
): Generation {
  private val jobHolder = JobHolder()
  @Volatile
  private var writtenFile: File? = null

  override fun searchEvent(query: EventSearch, collector: (PodEvent.Parsed) -> Unit) {
    memory.forEach { it.searchEvent(query, collector) }
  }

  val totalEvents: Int get() = memory.sumOf { it.size }

  fun startWrite() {
    memory.forEach { it.terminate() } // Forbid adding new events to generations being writing
    jobHolder.ensureStarted { doWrite() }
  }

  fun getWrittenFile(): File? = writtenFile

  fun contains(gen: MemoryGeneration) = memory.contains(gen)

  private fun doWrite() {
    var lastSid = -1L
    var lastTime = -1L
    forEachEvent {
      lastSid = max(lastSid, it.sid)
      lastTime = max(lastTime, it.time)
    }
    if (lastSid < 0 || lastTime < 0) {
      throw IllegalStateException("No events to write")
    }
    val file = File(root, FileInfo.filename(Instant.ofEpochMilli(lastTime), lastSid))
    FileOutputStream(file).use { stream ->
      EventSender.toStream(stream) { writer ->
        forEachEvent { writer.send(it) }
      }
    }
    writtenFile = file
    completeCallback()
  }

  private fun forEachEvent(block: (PodEvent.Parsed) -> Unit) {
    memory.forEach { it.searchEvent(EventSearch.EVERYTHING, block) }
  }
}