package com.almworks.dyoma.kubenetes.logs.server.db

import com.almworks.dyoma.kubenetes.logs.core.PodEvent
import com.almworks.dyoma.kubenetes.logs.server.receiveEvents
import java.io.File
import java.io.FileInputStream
import java.time.Instant
import java.util.regex.Pattern

class DiskGeneration private constructor(private val files: List<FileInfo>): Generation {
  companion object {
    fun loadFiles(root: File): DiskGeneration {
      val files = mutableListOf<FileInfo>()
      root.listFiles()?.forEach { toFileInfo(it)?.also(files::add) }
      return DiskGeneration(files)
    }

    private fun toFileInfo(file: File): FileInfo? {
      val name = file.name
      val m = FN_PATTERN.matcher(name)
      if (!m.matches()) return null
      val timeStr = m.group(1)
      val sidStr = m.group(2)
      val time: Instant
      val sid: Long
      try {
        time = Instant.parse(timeStr)
        sid = sidStr.toLong()
      } catch (e: Exception) {
        return null
      }
      return FileInfo(sid, time, file)
    }
  }

  fun withFile(file: File) = toFileInfo(file)?.let { DiskGeneration(files + it) } ?: this

  override fun searchEvent(query: EventSearch, collector: (PodEvent.Parsed) -> Unit) {
    files.asSequence()
      .filter { query.fromSid == null || it.lastSid >= query.fromSid }
      .filter { query.fromTime == null || it.listTime >= query.fromTime }
      .forEach { file ->
        FileInputStream(file.file).use { stream ->
          receiveEvents(stream).forEach(query.sendMatchingTo(collector))
        }
      }
  }
}

private val FN_PATTERN = Pattern.compile("""^([^\[]+)\[(\d+)]\.est$""")

private data class FileInfo(val lastSid: Long, val listTime: Instant, val file: File)