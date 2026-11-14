/** Event mapping (events.ts), the broadcaster (broadcast.ts) and publish-on-commit (fabric.ts), without a network. OWNER: P3. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommitStatusError, EndorseError, type ChaincodeEvent } from "@hyperledger/fabric-gateway";
import { FabricLedger, submitVia } from "../src/ledger/fabric";
import { EventBroadcaster } from "../src/ledger/broadcast";
import { sseMessage, toLedgerEvent } from "../src/ledger/events";
import { LedgerError, type EventSubscription } from "../src/ledger/types";
import { MILESTONE_RECORDED_EVENT } from "../src/generated/contracts";

const MILESTONE = { sb_hash: "e".repeat(64), milestone: "DOCS_ACKNOWLEDGED", tx_id: "tx-1" };
const sdkEvent = (over: Partial<ChaincodeEvent> = {}): ChaincodeEvent => ({
  blockNumber: 7n,
  transactionId: "tx-1",
  chaincodeName: "s14",
  eventName: MILESTONE_RECORDED_EVENT,
  payload: new TextEncoder().encode(JSON.stringify(MILESTONE)),
  ...over,
});

afterEach(() => vi.restoreAllMocks());

describe("toLedgerEvent", () => {
  it("maps a MilestoneRecorded event to a LedgerEvent with a numeric block_number", () => {
    const ev = toLedgerEvent(sdkEvent());
    expect(ev).toEqual({ name: "MilestoneRecorded", block_number: 7, tx_id: "tx-1", event: MILESTONE });
    expect(typeof ev!.block_number).toBe("number");
  });

  it.each([
    ["another event name", sdkEvent({ eventName: "Other" })],
    ["a payload that is not JSON", sdkEvent({ payload: new TextEncoder().encode("{oops") })],
    ["an empty payload", sdkEvent({ payload: new Uint8Array() })],
    ["a JSON payload that is not an object", sdkEvent({ payload: new TextEncoder().encode('"x"') })],
  ])("skips %s and logs it to stderr", (_name, ev) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(toLedgerEvent(ev)).toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
  });

  it("sseMessage puts the whole LedgerEvent on one data line", () => {
    const ev = toLedgerEvent(sdkEvent())!;
    const msg = sseMessage(ev);
    expect(msg).toBe(`event: MilestoneRecorded\ndata: ${JSON.stringify(ev)}\n\n`);
    expect(msg.split("\n")).toHaveLength(4);
  });
});

describe("EventBroadcaster", () => {
  const next = (sub: EventSubscription) => sub.stream[Symbol.asyncIterator]().next();

  it("delivers a published event to a waiting subscriber", async () => {
    const b = new EventBroadcaster();
    const sub = b.subscribe();
    const pending = next(sub);
    b.publish(sdkEvent());
    expect((await pending).value?.transactionId).toBe("tx-1");
  });

  it("delivers to every subscriber, in publish order", async () => {
    const b = new EventBroadcaster();
    const [s1, s2] = [b.subscribe(), b.subscribe()];
    b.publish(sdkEvent());
    b.publish(sdkEvent({ transactionId: "tx-2" }));
    for (const sub of [s1, s2]) {
      const it = sub.stream[Symbol.asyncIterator]();
      expect([(await it.next()).value?.transactionId, (await it.next()).value?.transactionId]).toEqual(["tx-1", "tx-2"]);
    }
  });

  it("does not replay events published before the subscription", async () => {
    const b = new EventBroadcaster();
    b.publish(sdkEvent({ transactionId: "old" }));
    const sub = b.subscribe();
    b.publish(sdkEvent({ transactionId: "new" }));
    expect((await next(sub)).value?.transactionId).toBe("new");
  });

  it("close() ends a pending for-await and unsubscribes; a closed subscriber receives nothing", async () => {
    const b = new EventBroadcaster();
    const sub = b.subscribe();
    const got: string[] = [];
    const loop = (async () => {
      for await (const ev of sub.stream) got.push(ev.transactionId);
    })();
    await Promise.resolve();
    sub.close();
    await loop;
    expect(b.size).toBe(0);
    b.publish(sdkEvent());
    expect(got).toEqual([]);
    expect((await next(sub)).done).toBe(true);
  });

  it("closeAll() ends every stream", async () => {
    const b = new EventBroadcaster();
    const subs = [b.subscribe(), b.subscribe()];
    const pending = subs.map(next);
    b.closeAll();
    expect((await Promise.all(pending)).map((r) => r.done)).toEqual([true, true]);
    expect(b.size).toBe(0);
  });

  it("on overflow drops the oldest pending event and logs once", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const b = new EventBroadcaster(2);
    const sub = b.subscribe();
    for (const id of ["tx-1", "tx-2", "tx-3", "tx-4"]) b.publish(sdkEvent({ transactionId: id }));
    const it = sub.stream[Symbol.asyncIterator]();
    expect([(await it.next()).value?.transactionId, (await it.next()).value?.transactionId]).toEqual(["tx-3", "tx-4"]);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("publish on a VALID RecordMilestone commit (D-34)", () => {
  const RESULT = new TextEncoder().encode(JSON.stringify(MILESTONE));
  const submitted = (code: number) => ({
    getResult: () => RESULT,
    getBytes: () => new Uint8Array([1]),
    getStatus: async () => ({ code, successful: code === 0, transactionId: "tx-1", blockNumber: 7n }),
  });
  const contract = (submitAsync: () => Promise<unknown>) => ({ submitAsync, evaluateTransaction: async () => new Uint8Array() }) as any;

  it("publishes one MilestoneRecorded event with the commit's block, tx id and the result bytes", async () => {
    const publish = vi.fn();
    await submitVia(contract(async () => submitted(0)), "RecordMilestone", ["{}"], { publish });
    expect(publish).toHaveBeenCalledOnce();
    const ev = publish.mock.calls[0][0];
    expect(ev).toEqual({ blockNumber: 7n, transactionId: "tx-1", eventName: MILESTONE_RECORDED_EVENT, payload: RESULT });
    expect(toLedgerEvent(ev)).toEqual({ name: "MilestoneRecorded", block_number: 7, tx_id: "tx-1", event: MILESTONE });
  });

  it("publishes after the other orgs' peers have been asked", async () => {
    const order: string[] = [];
    const other = { name: "Org2MSP", newCommit: () => ({ getStatus: async () => (order.push("other"), submitted(0).getStatus()) }) };
    const publish = () => void order.push("publish");
    await submitVia(contract(async () => submitted(0)), "RecordMilestone", ["{}"], { publish, otherOrgs: [other as any] });
    expect(order).toEqual(["other", "publish"]);
  });

  it("does not publish for CreateRecord", async () => {
    const publish = vi.fn();
    await submitVia(contract(async () => submitted(0)), "CreateRecord", ["a"], { publish });
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not publish when the commit is invalidated", async () => {
    const publish = vi.fn();
    await expect(submitVia(contract(async () => submitted(11)), "RecordMilestone", ["{}"], { publish })).rejects.toBeInstanceOf(LedgerError);
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not publish when the commit status is unknown", async () => {
    const publish = vi.fn();
    const unknown = {
      ...submitted(0),
      getStatus: async () => {
        throw new CommitStatusError({ code: 4, details: [], cause: new Error("grpc") as any, transactionId: "tx-9" });
      },
    };
    const err = await submitVia(contract(async () => unknown), "RecordMilestone", ["{}"], { publish }).catch((e) => e);
    expect(err.failure.kind).toBe("outcome_unknown");
    expect(publish).not.toHaveBeenCalled();
  });

  it("does not publish when endorsement fails", async () => {
    const publish = vi.fn();
    const endorse = new EndorseError({
      code: 10,
      details: [{ address: "p", mspId: "Org1MSP", message: "chaincode response 500, WRONG_ROLE: x" }],
      cause: new Error("grpc") as any,
      transactionId: "tx-e",
      message: "endorse failed",
    });
    await expect(submitVia(contract(async () => Promise.reject(endorse)), "RecordMilestone", ["{}"], { publish })).rejects.toBeInstanceOf(LedgerError);
    expect(publish).not.toHaveBeenCalled();
  });

  it("a publish that throws is logged and the submit still succeeds", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const publish = () => {
      throw new Error("boom");
    };
    await expect(submitVia(contract(async () => submitted(0)), "RecordMilestone", ["{}"], { publish })).resolves.toMatchObject({ txId: "tx-1" });
    expect(log).toHaveBeenCalledOnce();
  });

  it("feeds a broadcaster's subscribers end to end", async () => {
    const b = new EventBroadcaster();
    const [s1, s2] = [b.subscribe(), b.subscribe()];
    await submitVia(contract(async () => submitted(0)), "RecordMilestone", ["{}"], { publish: (ev) => b.publish(ev) });
    for (const sub of [s1, s2]) {
      expect((await sub.stream[Symbol.asyncIterator]().next()).value?.transactionId).toBe("tx-1");
    }
  });
});

describe("FabricLedger.events", () => {
  it("is an in-process subscription (no peer connection needed) that close() ends", async () => {
    const ledger = await FabricLedger.connect({ port: 8800, channel: "c", chaincode: "c", identities: {} });
    const sub = ledger.events("AD_BANK");
    const pending = sub.stream[Symbol.asyncIterator]().next();
    ledger.close();
    expect((await pending).done).toBe(true);
  });
});
