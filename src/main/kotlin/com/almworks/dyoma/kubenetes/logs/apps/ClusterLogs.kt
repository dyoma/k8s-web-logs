package com.almworks.dyoma.kubenetes.logs.apps

import com.almworks.dyoma.kubenetes.logs.core.K8sClient
import com.almworks.dyoma.kubenetes.logs.core.PodLogsLoader
import com.almworks.dyoma.kubenetes.logs.server.*
import kotlinx.coroutines.runBlocking

fun main(): Unit = runBlocking {
  val server = Server.startDefault()
  val extractor = PodLogsLoader()
  extractor.start(server.db::receiveEvent)

  val client = K8sClient.fromConfig(Server::class.java.getResource("kubeConfig.yml")!!)
  client.listPods("default")
//    .filter { it.name == "front-0" } // Uncomment to choose PODs you want to load logs from
    .forEach(extractor::loadLogs)
}