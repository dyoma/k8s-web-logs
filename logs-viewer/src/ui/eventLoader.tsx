import * as React from "react";
import {SubscriptionListener} from "../utils/listeners";
import {loadEvents, Pod} from "../data/loadEvents";
import {EventListHolder, ObservableEventList} from "./operations";
import {ReactNode} from "react";

export function EventLoader(props: {apiUri: string, children: ReactNode | ReactNode[]}) {
  const loader = React.useMemo(() => new EventLoaderProcess(props.apiUri), [props.apiUri]);
  return <Context.Provider value={loader}>
    {props.children}
  </Context.Provider>
}
const Context = React.createContext<EventLoaderProcess | null>(null)
export namespace EventLoader {
  export function useProcess(): EventLoaderProcess {
    return React.useContext(Context)!!
  }

  export function useAllEvents(): ObservableEventList {
    return useProcess().events
  }
}

export class EventLoaderProcess {
  private readonly subscriptionListener: SubscriptionListener = {
    onFirstSubscribe: () => {
      if (this.running) return
      this.running = true
      this.pingServer()
    },
    onLastUnsubscribe: () => {
      this.running = false
    }
  }
  private running = false
  readonly events = new EventListHolder(this.subscriptionListener)
  private lastSid = -1
  private readonly pods: Pod[] = []
  pingMillis: number

  constructor(readonly apiUri: string, pingMillis?: number) {
    this.pingMillis = pingMillis || 5000
    this.events.debugName = "Event-Loader"
  }

  private async pingServer() {
    try {
      const update = await loadEvents(this.apiUri, this.lastSid + 1, this.pods);
      if (update.events.length > 0) {
        this.lastSid = update.sid
        update.pods.forEach(p => this.pods.push(p))
        this.events.update(["new", update.events])
      }
    } finally {
      if (this.running) setTimeout(() => this.pingServer(), this.pingMillis)
    }
  }
}
