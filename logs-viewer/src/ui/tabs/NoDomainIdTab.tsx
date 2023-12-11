import * as React from "react";
import {DisplayableEvents} from "../commons/events";
import {LEvent} from "../../data/loadEvents";
import {EventViewer} from "./allTab";


const IGNORE_LOGGERS_PREFIXES = [
  "com.almworks.structure.cloud.commons.api.metadata.flag.FlagsLoadingRef",
  "org.apache.",
  "akka.",
  "org.springframework.",
  "com.almworks.structure.cloud.commons.akka.",
  "com.typesafe.",
  "com.almworks.structure.cloud.commons.cluster.ExtendedClusterActor",
  "com.almworks.structure.cloud.front.service.ExtensionVersionWatcher",
  "com.almworks.structure.cloud.commons.k8s.ApplicationStatusImpl",
  "com.almworks.structure.cloud.commons.grpc.SelectPodWatcherImplementation",
  "com.almworks.structure.cloud.commons.service.ExtendedJmxMetricsCollector",
  "com.almworks.structure.cloud.commons.AuxiliaryHttpServerImpl",
  "com.almworks.structure.cloud.commons.util.GrpcServer",
  "com.almworks.structure.cloud.commons.vault.auth.VaultSessionManager",
  "com.almworks.structure.cloud.commons.i18n.JsonI18nHelper$Companion",
  "com.almworks.structure.cloud.commons.http.client.CommonPoolHttpClient",
  "com.almworks.structure.cloud.commons.kafka.KafkaAdmin"
]

export function NoDomainIdEvents() {
  const displayableFilter = React.useContext(DisplayableEvents)
  function isNoDomainEvent(e: LEvent): boolean {
    if (e.data.domainId) return false
    const ignoredLogger = IGNORE_LOGGERS_PREFIXES.find(prefix => {
      return e.data.logger_name.startsWith(prefix)
    })
    return !ignoredLogger
  }
  const filter = React.useMemo(() => {
    return (e: LEvent) => {
      return displayableFilter(e) && isNoDomainEvent(e)
    }
  } , [displayableFilter])
  return <EventViewer filter={filter}/>
}
