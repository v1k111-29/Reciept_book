/**
 * In-process fan-out of ledger events to GET /events subscribers (N4, D-34). OWNER: P3.
 *
 * Drunix lite peers serve no block or chaincode events, so the gateway publishes an event itself when a
 * RecordMilestone it submitted is confirmed VALID (ledger/fabric.ts). No replay: a subscriber sees only
 * events published after it subscribed. Each subscriber has its own queue, capped at `cap` pending
 * events; on overflow the oldest is dropped and the first drop is logged once per subscriber.
 */
import type { ChaincodeEventLike, EventSubscription } from "./types.js";

/** Pending events kept per subscriber before the oldest is dropped. */
export const SUBSCRIBER_QUEUE_CAP = 1000;

class Subscriber implements EventSubscription {
  private readonly queue: ChaincodeEventLike[] = [];
  private wake: (() => void) | undefined;
  private closed = false;
  private warned = false;

  constructor(
    private readonly cap: number,
    private readonly onClose: (sub: Subscriber) => void,
  ) {}

  deliver(ev: ChaincodeEventLike): void {
    if (this.closed) return;
    if (this.queue.length >= this.cap) {
      this.queue.shift();
      if (!this.warned) {
        this.warned = true;
        console.warn(`gateway: an events subscriber has ${this.cap} pending events; dropping the oldest`);
      }
    }
    this.queue.push(ev);
    this.notify();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.queue.length = 0;
    this.onClose(this);
    this.notify();
  }

  private notify(): void {
    const wake = this.wake;
    this.wake = undefined;
    wake?.();
  }

  readonly stream: AsyncIterable<ChaincodeEventLike> = {
    [Symbol.asyncIterator]: () => ({
      next: async (): Promise<IteratorResult<ChaincodeEventLike>> => {
        for (;;) {
          if (this.closed) return { done: true, value: undefined };
          const ev = this.queue.shift();
          if (ev) return { done: false, value: ev };
          await new Promise<void>((resolve) => (this.wake = resolve));
        }
      },
      return: async (): Promise<IteratorResult<ChaincodeEventLike>> => {
        // A `for await` that breaks early ends the subscription too.
        this.close();
        return { done: true, value: undefined };
      },
    }),
  };
}

export class EventBroadcaster {
  private readonly subscribers = new Set<Subscriber>();

  constructor(private readonly cap: number = SUBSCRIBER_QUEUE_CAP) {}

  /** A new subscription that receives every event published from now on until close(). */
  subscribe(): EventSubscription {
    const sub = new Subscriber(this.cap, (s) => this.subscribers.delete(s));
    this.subscribers.add(sub);
    return sub;
  }

  /** Deliver `ev` to every current subscriber. Never blocks and never throws. */
  publish(ev: ChaincodeEventLike): void {
    for (const sub of this.subscribers) sub.deliver(ev);
  }

  /** Number of open subscriptions (for tests and logs). */
  get size(): number {
    return this.subscribers.size;
  }

  /** Close every subscription: their streams end. */
  closeAll(): void {
    for (const sub of [...this.subscribers]) sub.close();
  }
}
