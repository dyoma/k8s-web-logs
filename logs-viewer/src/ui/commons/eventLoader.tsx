import * as React from "react";
import {ReactNode} from "react";
import {SubscriptionListener} from "../../utils/listeners";
import {EventData, LEvent, loadEvents, Pod} from "../../data/loadEvents";
import {ObservableSet, SetHolder} from "./operations";
import {List} from "../../utils/collections";

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
  private readonly optimizer = new OptimizeEvents()
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
        this.events.update(["new", this.optimizer.optimizeEventList(update.events)])
      }
    } finally {
      if (this.running) setTimeout(() => this.pingServer(), this.pingMillis)
    }
  }
}

class OptimizeEvents {
  private readonly strings = new Map<string, string>()
  private hitCount = 0
  private hitLength = 0

  optimizeEventList(events: List<LEvent>): List<LEvent> {
    return events.map(e => this.optimize(e))
  }

  optimize(event: LEvent): LEvent {
    return new LEvent(event.sid, event.time, event.pod, this.optimizeData(event.data))
  }

  private optimizeValue<T>(value: T): T {
    const strings = this.strings
    if (value === null || value === undefined) return value
    if (typeof value !== "string") return value
    if (strings.has(value)) return strings.get(value) as T
    this.hitCount++
    this.hitLength += value.length
    strings.set(value, value)
    return value
  }

  private optimizeData(data: EventData): EventData  {
    const optimized: EventData = {}
    for (const key of Object.keys(data)) {
      const val = data[key]
      optimized[key] = this.optimizeValue(val)
    }
    return optimized
  }
}