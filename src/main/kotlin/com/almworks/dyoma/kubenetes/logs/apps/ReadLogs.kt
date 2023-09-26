package com.almworks.dyoma.kubenetes.logs.apps

import com.almworks.dyoma.kubenetes.logs.core.*
import com.almworks.dyoma.kubenetes.logs.server.*
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.FileInputStream
import java.time.Instant
import java.util.regex.Pattern

fun main(): Unit = runBlocking {
  val server = Server.startDefault()

  val totalOrder = EventTotalOrder()
  val files = arrayListOf(
    // Add your log files here
    File("path/to/logs-from-POD-0 (3).log")
  )
  parseFiles(files, server, totalOrder)
}

private val FILE_NAME = Pattern.compile("(logs-from-)?([^ (]+).*")
private suspend fun parseFiles(
  files: ArrayList<File>,
  server: Server,
  totalOrder: EventTotalOrder
) {
  files.forEach { file ->
    val m = FILE_NAME.matcher(file.name)
    val podName = if (m.matches()) m.group(2)
    else file.name.substringBefore(".", file.name)
    FileInputStream(file).use { stream ->
      ReceivedPodEvent.parsePodEventStream(
        PodInfo(podName, Instant.now()),
        stream
      ) { server.db.receiveEvent(totalOrder.assignSid(it)) }
    }
  }
}