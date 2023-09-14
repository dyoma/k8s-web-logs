package com.almworks.dyoma.kubenetes.logs.apps

import com.almworks.dyoma.kubenetes.logs.core.*
import com.almworks.dyoma.kubenetes.logs.server.*
import kotlinx.coroutines.runBlocking
import java.io.File
import java.io.FileInputStream
import java.time.Instant

fun main(): Unit = runBlocking {
  val server = Server.startDefault()

  val totalOrder = EventTotalOrder()
  FileInputStream(File("/Users/dyoma/Downloads/logs-from-content-in-content-0 (32).log")).use { stream ->
    ReceivedPodEvent.parsePodEventStream(PodInfo("XXX", Instant.now()), stream) { server.db.receiveEvent(totalOrder.assignSid(it)) }
  }
}