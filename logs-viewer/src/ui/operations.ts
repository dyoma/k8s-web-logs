import {List, MutableObjMap, MutableObjSet, ObjMap} from "../utils/collections";
import {LEvent} from "../data/loadEvents";
import {Listeners, Notification, SubscriptionCounterWithListeners, SubscriptionListener} from "../utils/listeners";
import * as React from "react";

export type EventListUpdate = ["new" | "reset", List<LEvent>]
export type ListUpdateListener = (upd: EventListUpdate) => void

export interface ObservableEventList {
  subscribe(listener: ListUpdateListener): () => void
  useSnapshot(): List<LEvent>
}

export class EventListHolder implements ObservableEventList {
  private readonly eventArray: LEvent[] = []
  private readonly listeners

  constructor(subscriptionListener: SubscriptionListener, debugName?: string) {
    this.listeners = new Listeners<EventListUpdate>(subscriptionListener, debugName)
  }

  currentList() { return new List(this.eventArray) }

  useSnapshot(): List<LEvent> {
    const [list, setList] = React.useState(new List(this.eventArray));
    React.useEffect(() => this.subscribe(() => setList(new List(this.eventArray))), [])
    return list
  }

  subscribe(listener: ListUpdateListener): Notification {
    const unsubscribe = this.listeners.subscribe(listener);
    listener(["reset", new List(this.eventArray)])
    return unsubscribe
  }

  update(upd: EventListUpdate) {
    const newEvents = upd[1];
    if (upd[0] === "new") {
      if (newEvents.length === 0) return;
    } else if (upd[0] === "reset") {
      this.eventArray.length = 0
    } else throw Error(`Unknown event ${upd[0]}`)
    newEvents.forEach(e => this.eventArray.push(e))
    this.listeners.fire(upd)
  }
}

export class FilterOperation implements ObservableEventList {
  private readonly subscriptionListener: SubscriptionListener = {
    onFirstSubscribe: () => {
      console.assert(!this.unsubscribeFromMaster)
      this.unsubscribeFromMaster = this.master.subscribe(upd => this.onUpdate(upd))
    },

    onLastUnsubscribe: () => {
      this.unsubscribeFromMaster!!()
      this.unsubscribeFromMaster = undefined
      this.holder.update(["reset", List.empty()])
    }
  }
  private readonly holder: EventListHolder
  private unsubscribeFromMaster?: () => void

  private constructor(private readonly master: ObservableEventList,
                      private readonly filter: (e: LEvent) => boolean,
                      debugName?: string) {
    this.holder = new EventListHolder(this.subscriptionListener, debugName)
  }

  static useFilter(master: ObservableEventList, filter: (e: LEvent) => boolean, debugName?: string): FilterOperation {
    return React.useMemo(() => new FilterOperation(master, filter, debugName), [master, filter])
  }

  useSnapshot(): List<LEvent> { return this.holder.useSnapshot() }

  subscribe(listener: ListUpdateListener) { return this.holder.subscribe(listener) }

  private onUpdate(upd: EventListUpdate) {
    this.holder.update([upd[0], upd[1].filter(this.filter)])
  }
}

export type EventMapUpdate<K> = ObjMap<K, EventListUpdate>
export type MapUpdateListener<K> = (upd: EventMapUpdate<K>) => void

export class EventGroups<K> {
  private readonly groups: MutableObjMap<K, EventListHolder>
  private readonly subscriptionListener: SubscriptionListener = {
    onFirstSubscribe: () => {
      console.assert(!this.unsubscribeFromMaster)
      this.unsubscribeFromMaster = this.master.subscribe(upd => this.onUpdate(upd))
    },
    onLastUnsubscribe: () => {
      this.unsubscribeFromMaster!!()
      this.unsubscribeFromMaster = undefined
      this.groups.forEach(group => group.update(["reset", List.empty()]))
    }
  }
  private readonly subscriptions: SubscriptionCounterWithListeners<EventMapUpdate<K>>
  private unsubscribeFromMaster?: () => void

  private constructor(private readonly master: ObservableEventList,
                      private readonly grouper: (e: LEvent) => K,
                      keyId: (k: K) => string,
                      debugName?: string) {
    this.subscriptions = new SubscriptionCounterWithListeners(this.subscriptionListener, debugName)
    this.groups = new MutableObjMap(keyId)
  }

  static useTextGrouper(master: ObservableEventList, grouper: (e: LEvent) => string, debugName?: string): EventGroups<string> {
    return this.useGrouper(master, grouper, s => s, debugName)
  }

  static useGrouper<K>(master: ObservableEventList, grouper: (e: LEvent) => K, keyId: (k: K) => string, debugName?: string): EventGroups<K> {
    return React.useMemo(() => new EventGroups<K>(master, grouper, keyId, debugName), [master, grouper, keyId])
  }

  useSnapshot(): ObjMap<K, List<LEvent>> {
    const [map, setMap] = React.useState<ObjMap<K, List<LEvent>>>(() => this.currentState());
    React.useEffect(() => this.subscribe(upd => {
      setMap((prev) => {
        const newMap = new MutableObjMap<K, List<LEvent>>(this.groups.keyId)
        const allKeys = new MutableObjSet(this.groups.keyId)
        allKeys.addAllKeys(upd)
        allKeys.addAllKeys(prev)
        allKeys.forEach(key => {
          if (upd.has(key)) newMap.set(key, this.groups.get(key)!!.currentList())
          else newMap.set(key, prev.get(key)!!)
        })
        return newMap
      })
    }), [])
    return map
  }

  currentState() {
    return this.groups.transformValues(group => group.currentList())
  }

  subscribe(listener: MapUpdateListener<K>): Notification {
    const unsubscribe = this.subscriptions.listeners.subscribe(listener)
    const initialUpdate = this.groups
        .transformValues<EventListUpdate>(group => ["reset", group.currentList()]);
    listener(initialUpdate)
    return unsubscribe
  }

  private onUpdate(upd: EventListUpdate) {
    if (upd[1].length === 0) return
    const arrayMap = new MutableObjMap<K, LEvent[]>(this.groups.keyId)
    upd[1].forEach(event => arrayMap.computeIfAbsent(this.grouper(event), () => []).push(event))
    const updMap = arrayMap.transformValues<EventListUpdate>(arr => [upd[0], new List(arr)])
    updMap.forEach((groupUpd, groupKey) => {
      const group = this.groups.computeIfAbsent(groupKey, () =>
          new EventListHolder(this.subscriptions.counter, `Group[${this.groups.keyId(groupKey)}]`));
      group.update(groupUpd)
    })
    this.subscriptions.listeners.fire(updMap)
  }
}
