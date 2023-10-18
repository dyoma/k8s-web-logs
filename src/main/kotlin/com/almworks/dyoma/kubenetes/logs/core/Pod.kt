package com.almworks.dyoma.kubenetes.logs.core

import io.kubernetes.client.openapi.models.V1Pod
import java.time.Instant
import java.time.format.DateTimeFormatter

class Pod(private val client: K8sClient, private val pod: V1Pod) {
  val metadata = pod.metadata!!

  val name = metadata.name!!

  val startedAt = pod.status?.startTime?.toInstant() ?: Instant.now()

  val runId = "${metadata.name!!}=${DateTimeFormatter.ISO_INSTANT.format(startedAt)}"

  fun streamLog(sinceSeconds: Int? = null, tailLines: Int? = null, timestamp: Boolean = false) = client.podLogs.streamNamespacedPodLog(pod.metadata!!.namespace, pod.metadata!!.name, null, null, tailLines, timestamp)
}