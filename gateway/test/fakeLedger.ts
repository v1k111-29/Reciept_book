/** Test double for the Ledger interface. OWNER: P3. Records calls; behaviour is set per test. */
import type { ChaincodeFunction, OrgRole } from "../src/generated/contracts";
import type { ChaincodeEventLike, EventSubscription, Ledger } from "../src/ledger/types";

/**
 * A fake chaincode event subscription: push() delivers an event, fail() makes the stream throw,
 * close() (called by the server) ends it. `closed` records whether the server closed it.
 */
export class FakeSubscription implements EventSubscription {
  closed = false;
  private queue: ChaincodeEventLike[] = [];
  private error: unknown;
  private wake: (() => void) | undefined;

  constructor(readonly identity: OrgRole) {}

  push(ev: ChaincodeEventLike): void {
    this.queue.push(ev);
    this.notify();
  }

  fail(err: unknown): void {
    this.error = err;
    this.notify();
  }

  close(): void {
    this.closed = true;
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
          if (this.error !== undefined) throw this.error;
          const ev = this.queue.shift();
          if (ev) return { done: false, value: ev };
          await new Promise<void>((resolve) => (this.wake = resolve));
        }
      },
    }),
  };
}

export interface Call {
  kind: "submit" | "evaluate";
  fn: ChaincodeFunction;
  args: string[];
  identity: OrgRole;
}

export class FakeLedger implements Ledger {
  calls: Call[] = [];
  identities: Set<OrgRole> = new Set(["AD_BANK", "EXPORTERS_BODY"]);
  submitImpl: (call: Call) => Promise<{ txId: string; result: string }> = async () => ({
    txId: "tx-1",
    result: JSON.stringify({ ok: "submitted" }),
  });
  evaluateImpl: (call: Call) => Promise<string> = async () => JSON.stringify({ ok: "evaluated" });
  /** Every subscription opened through events(), newest last. */
  subscriptions: FakeSubscription[] = [];

  hasIdentity(identity: OrgRole): boolean {
    return this.identities.has(identity);
  }

  submit(fn: ChaincodeFunction, args: string[], identity: OrgRole) {
    const call: Call = { kind: "submit", fn, args, identity };
    this.calls.push(call);
    return this.submitImpl(call);
  }

  evaluate(fn: ChaincodeFunction, args: string[], identity: OrgRole) {
    const call: Call = { kind: "evaluate", fn, args, identity };
    this.calls.push(call);
    return this.evaluateImpl(call);
  }

  events(identity: OrgRole): EventSubscription {
    const sub = new FakeSubscription(identity);
    this.subscriptions.push(sub);
    return sub;
  }
}
