package com.almworks.dyoma.kubenetes.logs.apps

import com.almworks.dyoma.kubenetes.logs.core.*
import com.almworks.dyoma.kubenetes.logs.server.*
import kotlinx.coroutines.runBlocking

/**
 * POD's name prefixes to ignore.
 * These short-living PODs does not produce any logs, so we ignore them
 */
private val ignorePods = listOf("gantt-migration-cron-watcher-job-", "jira-webhooks-ingress-webhooks-job-", "cassandra-manager-trusted-app-integration-")

fun main(): Unit = runBlocking {
  val server = Server.startDefault()
  val extractor = PodLogsLoader()
  extractor.start(server.db::receiveEvent)

  val client = K8sClient.fromConfig(Server::class.java.getResource("kubeConfig.yml")!!)
  PodWatcher(client).start(
    filter = { pod -> ignorePods.find { namePrefix -> pod.name.startsWith(namePrefix) } == null }
  ) { it.forEach(extractor::loadLogs) }
}