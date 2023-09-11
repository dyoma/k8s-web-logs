package com.almworks.dyoma.kubenetes.logs

import io.kubernetes.client.openapi.models.V1Pod
import java.time.format.DateTimeFormatter

class Pod(private val client: K8sClient, private val pod: V1Pod) {
  val metadata = pod.metadata!!

  val name = metadata.name!!

  val startedAt = pod.status!!.startTime!!.toInstant()

  val runId = "${metadata.name!!}=${pod.status!!.startTime!!.format(DateTimeFormatter.ISO_INSTANT)}"

  fun streamLog(sinceSeconds: Int? = null, tailLines: Int? = null, timestamp: Boolean = false) = client.podLogs.streamNamespacedPodLog(pod.metadata!!.namespace, pod.metadata!!.name, null, null, tailLines, timestamp)
}