package com.almworks.dyoma.kubenetes.logs.core

import kotlinx.coroutines.delay
import java.time.Duration

class PodWatcher(private val client: K8sClient) {
  private val jobHolder = JobHolder()

  fun start(
    namespace: String = "default",
    filter: ((Pod) -> Boolean) = { true },
    delay: Duration = Duration.ofSeconds(1),
    podsConsumer: (List<Pod>) -> Unit
  ) {
    jobHolder.ensureStarted {
      while (true) {
        val pods = client.listPods(namespace)
          .filter(filter)
        podsConsumer(pods)
        delay(delay.toMillis())
      }
    }
  }
}