package com.almworks.dyoma.kubenetes.logs.server

import com.almworks.dyoma.kubenetes.logs.K8sClient
import kotlinx.coroutines.runBlocking
import java.util.Properties

fun main(): Unit = runBlocking {
  val properties = Properties()
    .also { properties ->
      Server::class.java.getResourceAsStream("server.properties")!!.use { properties.load(it.reader()) }
    }
  val db = EventDb()
  Server.start(SendEvents(db), Integer.parseInt(properties.getProperty("server.port")))
  val client = K8sClient.fromConfig(Server::class.java.getResource("kubeConfig.yml")!!)
  val extractor = LogExtractor()
  extractor.start(db::receiveEvent)

  client.listPods("default")
//    .filter { it.name == "front-0" } // Uncomment to choose PODs you want to load logs from
    .forEach(extractor::loadLogs)
}