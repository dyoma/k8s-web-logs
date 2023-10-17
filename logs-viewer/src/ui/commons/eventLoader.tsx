import * as React from "react";
import {ReactNode} from "react";
import {SubscriptionListener} from "../../utils/listeners";
import {LEvent, loadEvents, Pod} from "../../data/loadEvents";
import {ObservableSet, SetHolder} from "./operations";

export function EventLoader(props: {apiUri: string, pingMillis?: number, children: ReactNode | ReactNode[]}) {
  const loader = React.useMemo(() => new EventLoaderProcess(props.apiUri, props.pingMillis), [props.apiUri]);
  return <Context.Provider value={loader}>
    {props.children}
  </Context.Provider>
}
const Context = React.createContext<EventLoaderProcess | null>(null)
export namespace EventLoader {
  export function useProcess(): EventLoaderProcess {
    return React.useContext(Context)!!
  }

  export function useAllEvents(): ObservableSet<LEvent> {
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
  readonly events = new SetHolder<LEvent>(this.subscriptionListener, LEvent.RECENT_FIRST_COMPARATOR)
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
