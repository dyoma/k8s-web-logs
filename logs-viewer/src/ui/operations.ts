import {Comparator, List, MutableObjMap, MutableObjSet, ObjMap} from "../utils/collections";
import {Listeners, Notification, SubscriptionCounterWithListeners, SubscriptionListener} from "../utils/listeners";
import * as React from "react";

/**
 * A set modification is a pair of type and elements. Types:
 * * new - add new elements to the set
 * * reset - replace all elements in the set with provided element
 */
export type SetUpdate<T> = ["new" | "reset", List<T>]
export type SetUpdateListener<T> = (upd: SetUpdate<T>) => void

export interface ObservableSet<T> {
  useFilter(filter: (t: T) => boolean, comparator?: Comparator<T>): ObservableSet<T>

  useTransform<D>(mapper: (t: T) => D | undefined, comparator?: Comparator<D>): ObservableSet<D>

  useGroupBy<K>(grouper: (t: T) => K, keyId: (k: K) => string, comparator?: (a: T, b: T) => number): GroupByOperation<T, K>

  useGroupByText(grouper: (t: T) => string, comparator?: (a: T, b: T) => number): GroupByOperation<T, string>

  debugName: string

  subscribe(listener: SetUpdateListener<T>): () => void
  useSnapshot(): List<T>
}

abstract class BaseObservableSet<T> implements ObservableSet<T> {
  useFilter(filter: (t: T) => boolean, comparator?: Comparator<T>): ObservableSet<T> {
    const mapper = React.useMemo(() => (t: T) => filter(t) ? t : undefined, [filter])
    return this.useTransform(mapper, comparator)
  }

  useTransform<D>(mapper: (t: T) => D | undefined, comparator?: Comparator<D>): ObservableSet<D> {
    return TransformOperation.useTransform(this, mapper, comparator)
  }

  useGroupBy<K>(grouper: (t: T) => K, keyId: (k: K) => string, comparator?: (a: T, b: T) => number): GroupByOperation<T, K> {
    return GroupByOperation.useGrouper(this, grouper, keyId, comparator)
  }

  useGroupByText(grouper: (t: T) => string, comparator?: (a: T, b: T) => number): GroupByOperation<T, string> {
    return this.useGroupBy(grouper, s => s, comparator)
  }

  abstract debugName: string;

  abstract subscribe(listener: SetUpdateListener<T>): () => void
  abstract useSnapshot(): List<T>
}

/**
 * Updates itself according to incoming {@link SetUpdate}s.
 * Optionally, sorts collected elements.
 * Resends all incoming events to its listeners ({@link subscribe})
 */
export class SetHolder<T> extends BaseObservableSet<T> {
  private readonly eventArray: T[] = []
  private readonly listeners

  constructor(subscriptionListener: SubscriptionListener, private readonly comparator?: (a: T, b: T) => number) {
    super()
    this.listeners = new Listeners<SetUpdate<T>>(subscriptionListener)
  }

  set debugName(name: string) {
    this.listeners.debugName = name
  }

  get debugName(): string { return this.listeners.debugName || "" }

  currentList() { return new List(this.eventArray) }

  useSnapshot(): List<T> {
    const [list, setList] = React.useState(new List(this.eventArray));
    React.useEffect(() => this.subscribe(() => setList(new List(this.eventArray))), [this])
    return list
  }

  subscribe(listener: SetUpdateListener<T>): Notification {
    const unsubscribe = this.listeners.subscribe(listener);
    listener(["reset", new List(this.eventArray)])
    return unsubscribe
  }

  update(upd: SetUpdate<T>) {
    const newEvents = upd[1];
    if (upd[0] === "new") {
      if (newEvents.length === 0) return;
    } else if (upd[0] === "reset") {
      this.eventArray.length = 0
    } else throw Error(`Unknown event ${upd[0]}`)
    newEvents.forEach(e => this.eventArray.push(e))
    if (this.comparator) {
      const message = `Sort[Total:${this.eventArray.length}, inc:${upd[1].length}]`
      console.time(message)
      this.eventArray.sort(this.comparator)
      console.timeEnd(message)
    }
    this.listeners.fire(upd)
  }
}

/**
 * Transforms elements of the {@link master} set by converting to other of filtering out.
 * Optionally supports ordering converted elements.
 * {@link mapper} either converts an element or returns `undefined` for filtering the element out
 */
class TransformOperation<S, D> extends BaseObservableSet<D> {
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
  private readonly holder: SetHolder<D>
  private unsubscribeFromMaster?: () => void

  private constructor(private readonly master: ObservableSet<S>,
                      private readonly mapper: (s: S) => D | undefined,
                      comparator?: (a: D, b: D) => number) {
    super()
    this.holder = new SetHolder<D>(this.subscriptionListener, comparator)
  }

  static useTransform<S, D>(master: ObservableSet<S>,
                            mapper: (s: S) => D | undefined,
                            comparator?: Comparator<D>): TransformOperation<S, D> {
    return React.useMemo(() => new TransformOperation(master, mapper, comparator), [master, mapper, comparator])
  }

  set debugName(name: string) {
    this.holder.debugName = name
  }

  get debugName() { return this.holder.debugName }

  useSnapshot(): List<D> { return this.holder.useSnapshot() }

  subscribe(listener: SetUpdateListener<D>) { return this.holder.subscribe(listener) }

  private onUpdate(upd: SetUpdate<S>) {
    const mapped: D[] = []
    upd[1].forEach(s => {
      const d = this.mapper(s);
      if (d !== undefined) mapped.push(d)
    })
    this.holder.update([upd[0], new List(mapped)])
  }
}

/**
 * Modification of a multimap is a map of keys to {@link SetUpdate}
 */
export type MapUpdate<T, K> = ObjMap<K, SetUpdate<T>>
export type MapUpdateListener<T, K> = (upd: MapUpdate<T, K>) => void

/**
 * Groups elements of {@link master} set by assigning keys provided by {@link grouper}.
 * Optionally sorts grouped elements
 * @see ObjMap
 */
export class GroupByOperation<T, K> {
  private readonly groups: MutableObjMap<K, SetHolder<T>>
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
  private readonly subscriptions: SubscriptionCounterWithListeners<MapUpdate<T, K>>
  private unsubscribeFromMaster?: () => void

  private constructor(private readonly master: ObservableSet<T>,
                      private readonly grouper: (t: T) => K,
                      keyId: (k: K) => string,
                      private readonly comparator?: (a: T, b: T) => number) {
    this.subscriptions = new SubscriptionCounterWithListeners(this.subscriptionListener)
    this.groups = new MutableObjMap(keyId)
  }

  set debugName(name: string | undefined) {
    this.subscriptions.debugName = name
  }

  get debugName() { return this.subscriptions.debugName }

  static useGrouper<T, K>(master: ObservableSet<T>, grouper: (t: T) => K, keyId: (k: K) => string, comparator?: (a: T, b: T) => number): GroupByOperation<T, K> {
    return React.useMemo(
        () => new GroupByOperation<T, K>(master, grouper, keyId, comparator),
        [master, grouper, keyId, comparator])
  }

  useSnapshot(): ObjMap<K, List<T>> {
    const [map, setMap] = React.useState<ObjMap<K, List<T>>>(() => this.currentState())
    React.useEffect(() => this.subscribe(upd => {
      setMap((prev) => {
        const newMap = new MutableObjMap<K, List<T>>(this.groups.keyId)
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

  subscribe(listener: MapUpdateListener<T, K>): Notification {
    const unsubscribe = this.subscriptions.listeners.subscribe(listener)
    const initialUpdate = this.groups
        .transformValues<SetUpdate<T>>(group => ["reset", group.currentList()]);
    listener(initialUpdate)
    return unsubscribe
  }

  private onUpdate(upd: SetUpdate<T>) {
    if (upd[1].length === 0) return
    const arrayMap = new MutableObjMap<K, T[]>(this.groups.keyId)
    upd[1].forEach(t => arrayMap.computeIfAbsent(this.grouper(t), () => []).push(t))
    const updMap = arrayMap.transformValues<SetUpdate<T>>(arr => [upd[0], new List(arr)])
    updMap.forEach((groupUpd, groupKey) => {
      const group = this.groups.computeIfAbsent(groupKey, () => {
        let holder = new SetHolder(this.subscriptions.counter, this.comparator)
        holder.debugName = `${this.debugName}-Group[${this.groups.keyId(groupKey)}]`
        return holder
      });
      group.update(groupUpd)
    })
    this.subscriptions.listeners.fire(updMap)
  }
}
