package com.almworks.dyoma.kubenetes.logs.apps

import com.almworks.dyoma.kubenetes.logs.core.*
import com.almworks.dyoma.kubenetes.logs.server.*
import kotlinx.coroutines.runBlocking
import java.net.URL

/**
 * POD's name prefixes to ignore.
 * These short-living PODs does not produce any logs, so we ignore them
 */
private val ignorePods = listOf(
  "gantt-migration-cron-watcher-job-",
  "jira-webhooks-ingress-webhooks-job-",
  "cassandra-manager-trusted-app-integration-",
  "module-remover-",
  "cassandra-manager-"
)


fun main(): Unit = runBlocking {
  val server = Server.startDefault()
  val extractor = PodLogsLoader()
  extractor.start(server.db::receiveEvent)

  val client = K8sClient.fromConfig(loadConfig())
  PodWatcher(client).start(
    filter = { pod -> ignorePods.find { namePrefix -> pod.name.startsWith(namePrefix) } == null }
  ) { it.forEach(extractor::loadLogs) }
}

private fun loadConfig(): URL {
  Server::class.java.getResource("/kubeConfig.yml")?.let { return it }
  return Server::class.java.getResource("kubeConfig.yml") ?: throw Exception("Cannot find kubeConfig.yml. Please, read README.md")
}