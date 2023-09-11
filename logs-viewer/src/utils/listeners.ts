export type Notification = () => void
export const ignoreNotification: Notification = () => {}


export interface SubscriptionListener {
  onFirstSubscribe(): void
  onLastUnsubscribe(): void
}

export namespace SubscriptionListener {
  export const DEAF: SubscriptionListener = {
    onFirstSubscribe() {},
    onLastUnsubscribe() {}
  }
}


export class SubscriptionCounter implements SubscriptionListener {
  private _count = 0

  constructor(private readonly listener: SubscriptionListener) {
  }

  onFirstSubscribe() {
    this._count++
    if (this._count === 1) this.listener.onFirstSubscribe()
  }
  onLastUnsubscribe() {
    this._count --
    if (this._count === 0) this.listener.onLastUnsubscribe()
  }

  get count() { return this._count }

  get isZero() { return this._count === 0 }
}

export class SubscriptionCounterWithListeners<U> implements SubscriptionListener{
  readonly listeners: Listeners<U>
  readonly counter = new SubscriptionCounter(this)
  constructor(private readonly listener: SubscriptionListener) {
    this.listeners = new Listeners<U>(this)
  }

  set debugName(name: string | undefined) {
    this.listeners.debugName = name
  }

  get debugName() { return this.listeners.debugName }

  onFirstSubscribe(): void {
    if ((this.counter.count === 1 && this.listeners.isEmpty)
        || (this.counter.isZero && this.listeners.count === 1))
      this.listener.onFirstSubscribe()
  }

  onLastUnsubscribe(): void {
    if (this.counter.isZero && this.listeners.isEmpty)
      this.listener.onLastUnsubscribe()
  }
}

export class Listeners<U> {
  private readonly listeners: ((u: U) => void)[] = []
  private static counter = 0
  private _debugName: string

  constructor(private readonly listener: SubscriptionListener) {
    this._debugName = `${Listeners.counter++}`
  }

  get debugName() { return this._debugName }

  set debugName(name: string | undefined) { if (name) this._debugName = name }

  fire(upd: U) {
    this.listeners.forEach(l => l(upd))
  }

  subscribe(listener: (u: U) => void): () => void {
    this.listeners.push(listener)
    if (this.listeners.length === 1) this.listener.onFirstSubscribe()
    this.log(`++ = ${this.listeners.length}`)
    return () => this.removeListener(listener)
  }

  get isEmpty() { return this.listeners.length === 0}

  get count() { return this.listeners.length }

  private removeListener(listener: (u: U) => void) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
      if (this.listeners.length === 0) this.listener.onLastUnsubscribe()
      this.log(`-- = ${this.listeners.length}`)
    } else this.log("Unknown listener", listener)
  }

  private log(...args: any[]) {
    console.log.apply(console, [`Listeners(${this.debugName}):`, ...args])
  }
}
