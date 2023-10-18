package com.almworks.dyoma.kubenetes.logs.core

import kotlinx.coroutines.delay
import org.slf4j.LoggerFactory
import java.time.Duration

class PodWatcher(private val client: K8sClient) {
  private val jobHolder = JobHolder()
  private val log = LoggerFactory.getLogger(PodWatcher::class.java)

  fun start(
    namespace: String = "default",
    filter: ((Pod) -> Boolean) = { true },
    delay: Duration = Duration.ofSeconds(1),
    podsConsumer: (List<Pod>) -> Unit
  ) {
    jobHolder.ensureStarted {
      while (true) {
        try {
          val pods = client.listPods(namespace)
            .filter(filter)
          podsConsumer(pods)
        } catch (e: Exception) {
          log.warn("Failed to list pods", e)
        }
        delay(delay.toMillis())
      }
    }
  }
}