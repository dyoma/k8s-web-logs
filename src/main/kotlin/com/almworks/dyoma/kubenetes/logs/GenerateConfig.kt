package com.almworks.dyoma.kubenetes.logs

fun main() {
  val rootDir = "" // location of your `ca.crt`, `client.crt`, `client.key` files.
  val cluster = "" // name of your cluster (example: `dyoma-1.dev.alm.works`). used for: `set-cluster`, `set-credentials`, etc.
  val server = "" // value of `--server` in the `kubectl config set-cluster CLUSTER --server=SERVER`
  println(createYmlConfig(rootDir, cluster, server))
}

fun createYmlConfig(rootDir: String, cluster: String, server: String) =
  """
apiVersion: v1
clusters:
  - cluster:
      certificate-authority: $rootDir/ca.crt
      server: $server
    name: $cluster
contexts:
  - context:
      cluster:  $cluster
      user:  $cluster
    name:  $cluster
current-context:  $cluster
kind: Config
preferences: {}
users:
  - name:  $cluster
    user:
      client-certificate: $rootDir/client.crt
      client-key: $rootDir/client.key
"""