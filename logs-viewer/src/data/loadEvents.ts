import axios from "axios";
import {List} from "../utils/collections";

namespace Raw {
  export type Pod = {
    type: "pod",
    id: number,
    name: string,
    startedAt: number
  }
  export type Event = {
    type: "event",
    sid: number,
    time: number,
    pod: number,
    data: {}
  }
}

type RawEvent = Raw.Pod | Raw.Event

export class Pod {
  constructor(readonly name: string, readonly startedAt: Date) {}

  get podId() {return `${this.name}-${this.startedAt.getTime()}`}
}

export type EventData = {
  message: String,
  logger_name: String,
  thread_name: String,
  level: String,

  stack_trace?: String
  traceId?: String
  spanId?: String
  /** ref to {@link spanId} */
  parentId?: String
  domainId?: String
} & any

export class LEvent {
  constructor(
      readonly sid: number,
      readonly time: Date,
      readonly pod: Pod,
      readonly data: EventData
  ) {}
}

export class EventsUpdate {
  constructor(readonly events: List<LEvent>,
              readonly pods: List<Pod>,
              readonly sid: number) {
  }
}

export async function loadEvents(apiUri: string, lastSid: number, knownPods: Pod[]): Promise<EventsUpdate> {
  const resp = await axios.get(`${apiUri}/events?sid=${lastSid}`)
  const raw: RawEvent[] = resp.data
  const allPods = new Map<string, Pod>()
  knownPods.forEach(pod => allPods.set(pod.podId, pod))
  const newPods: Pod[] = []
  const loadedPods: Pod[] = []
  const events: LEvent[] = []
  let newLastSid = lastSid
  raw.forEach(event => {
    if (event.type === "pod") {
      const newPod = new Pod(event.name, new Date(event.startedAt));
      const known = allPods.get(newPod.podId);
      if (known) loadedPods.push(known)
      else {
        newPods.push(newPod)
        loadedPods.push(newPod)
        allPods.set(newPod.podId, newPod)
      }
    } else if (event.type == "event") {
      events.push(new LEvent(event.sid, new Date(event.time), loadedPods[event.pod], event.data))
      if (newLastSid < event.sid) newLastSid = event.sid
    }
  })
  return new EventsUpdate(new List(events), new List(newPods), newLastSid)
}