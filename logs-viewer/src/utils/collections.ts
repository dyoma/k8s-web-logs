export class List<T> {
  constructor(readonly elements: T[]) {
  }

  private static readonly EMPTY = new List<any>([])

  static empty<T>(): List<T> { return this.EMPTY }

  get length() { return this.elements.length }

  filter(predicate: (ev: T, index: number, array: T[]) => boolean): List<T> {
    const filteredEvents = this.elements.filter(predicate);
    return new List(filteredEvents)
  }

  sublist(begin: number, end: number): List<T> {
    if (end > this.elements.length) end = this.elements.length
    if (begin === 0 && end === this.elements.length) return this
    if (begin >= end) return List.empty()
    return new List(this.elements.slice(begin, end))
  }

  groupBy<K>(getKey: (t: T) => K): Map<K, List<T>> {
    const map = new Map<K, T[]>()
    this.elements.forEach(e => {
      const key = getKey(e);
      let array = map.get(key);
      if (!array) {
        array = []
        map.set(key, array)
      }
      array.push(e)
    })
    const result = new Map<K, List<T>>()
    map.forEach((arr, k) => {
      result.set(k, new List(arr))
    })
    return result
  }

  toArray(): T[] {
    return [...this.elements]
  }

  map<D>(conv: (e: T, i: number) => D): List<D> {
    return new List(this.elements.map(conv))
  }

  mapToArray<D>(conv: (e: T, i: number, array: T[]) => D): D[] {
    return this.elements.map(conv)
  }

  forEach(callbackfn: (value: T, index: number, array: T[]) => void) {
    this.elements.forEach(callbackfn)
  }

  findIndex(predicate: (value: T) => boolean) {
    return this.elements.findIndex(predicate)
  }
}

/**
 * This is a read-only map from keys of any type to values. {@link keyId} defines equality for keys by converting them to `string`
 */
export class ObjMap<K, V> {
  protected readonly valueMap = new Map<string, V>()
  protected readonly keys: K[] = []

  constructor(public readonly keyId: (k: K) => string) {}

  get(key: K) {
    return this.valueMap.get(this.keyId(key))
  }

  transformValues<V2>(transform: (v: V) => V2): MutableObjMap<K, V2> {
    const result = new MutableObjMap<K, V2>(this.keyId)
    this.valueMap.forEach((value, strK) => result.valueMap.set(strK, transform(value)))
    this.keys.forEach(k => result.keys.push(k))
    return result
  }

  has(key: K): boolean {
    return this.valueMap.has(this.keyId(key))
  }

  forEach(callbackfn: (value: V, key: K, map: ObjMap<K, V>) => void) {
    this.keys.forEach(key => {
      const id = this.keyId(key);
      const value = this.valueMap.get(id);
      if (value !== undefined) callbackfn(value, key, this)
    })
  }

  toKeyValueArray(valueFilter?: (v: V) => boolean): [K, V][] {
    const result: [K, V][] = []
    this.forEach((value, key) => {
      if (valueFilter && !valueFilter(value)) return
      result.push([key, value])
    })
    return result
  }
}

declare global {
  interface Array<T> {
    sortBy<K>(getKey: (v: T) => K): Array<T>
  }
}

function sortBy<T, K>(this: T[], getKey: (v: T) => K) {
  return this.sort(Comparator.by(getKey))
}

export type Comparator<T> = (a: T, b: T) => number
export namespace Comparator {
  export function by<T, K>(getKey: (v: T) => K): Comparator<T> {
    return (a: T, b: T) => {
      const ka = getKey(a);
      const kb = getKey(b);
      if (ka == kb) return 0
      return ka < kb ? -1 : 1
    }
  }
}

Array.prototype.sortBy = sortBy

export class MutableObjMap<K, V> extends ObjMap<K, V> {
  constructor(keyId: (k: K) => string) {
    super(keyId)
  }

  computeIfAbsent(key: K, supplier: (k: K) => V): V {
    let value = this.get(key);
    if (value !== undefined) return value
    value = supplier(key)
    this.set(key, value)
    return value
  }

  set(key: K, value: V): V | undefined {
    const id = this.keyId(key);
    const prev = this.valueMap.get(id);
    if (prev === undefined) this.keys.push(key)
    this.valueMap.set(id, value)
    return prev
  }
}

export class MutableObjSet<T> {
  private readonly _set = new Set<string>()
  private readonly keys: T[] = []
  constructor(private readonly keyId: (t: T) => string) {}

  add(t: T) {
    const id = this.keyId(t);
    if (this._set.has(id)) return
    this._set.add(id)
    this.keys.push(t)
  }

  has(t: T): boolean {
    return this._set.has(this.keyId(t))
  }

  forEach(callbackfn: (value: T, set: MutableObjSet<T>) => void) {
    this.keys.forEach(t => {
      if (this.has(t)) callbackfn(t, this)
    })
  }

  addAllKeys(map: ObjMap<T, any>) {
    map.forEach((v, k) => this.add(k))
  }
}