package com.almworks.dyoma.kubenetes.logs

import io.kubernetes.client.PodLogs
import io.kubernetes.client.openapi.ApiClient
import io.kubernetes.client.openapi.apis.CoreV1Api
import io.kubernetes.client.util.ClientBuilder
import io.kubernetes.client.util.KubeConfig
import java.net.URL

class K8sClient(client: ApiClient) {
  companion object {
    fun fromConfig(resource: URL): K8sClient {
      val config = resource.openStream().use {
        KubeConfig.loadKubeConfig(it.reader())
      }
      val client = ClientBuilder.kubeconfig(config).build()
      return K8sClient(client)
    }
  }

  val coreApi = CoreV1Api(client)
  val podLogs = PodLogs(client)

  fun listPods(namespace: String): List<Pod> =
    coreApi.listNamespacedPod(namespace, null, null, null, null, null, null, null, null, null, null).items
      .map { Pod(this, it) }
}
