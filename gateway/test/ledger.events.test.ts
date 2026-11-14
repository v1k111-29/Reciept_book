/** Chaincode event subscription and mapping of src/ledger/fabric.ts + events.ts, without a network. OWNER: P3. */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChaincodeEvent, CloseableAsyncIterable } from "@hyperledger/fabric-gateway";
import { subscribeVia } from "../src/ledger/fabric";
import { sseMessage, toLedgerEvent } from "../src/ledger/events";
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

/** A CloseableAsyncIterable over fixed events that records close(). */
function iterable(events: ChaincodeEvent[]) {
  const state = { closed: 0 };
  const it: CloseableAsyncIterable<ChaincodeEvent> = {
    close: () => void state.closed++,
    [Symbol.dispose]: () => void state.closed++,
    async *[Symbol.asyncIterator]() {
      for (const ev of events) {
        if (state.closed) return;
        yield ev;
      }
    },
  };
  return { it, state };
}

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

describe("subscribeVia", () => {
  it("asks for the chaincode's events with no start position (next committed block on, no replay)", async () => {
    const { it: events } = iterable([sdkEvent()]);
    const getChaincodeEvents = vi.fn(async () => events);
    const sub = subscribeVia({ getChaincodeEvents }, "s14");
    const got = [];
    for await (const ev of sub.stream) got.push(ev);
    expect(getChaincodeEvents).toHaveBeenCalledWith("s14");
    expect(getChaincodeEvents.mock.calls[0]).toHaveLength(1);
    expect(got.map((e) => e.transactionId)).toEqual(["tx-1"]);
  });

  it("close() closes the SDK iterable and ends the stream", async () => {
    const { it: events, state } = iterable([sdkEvent(), sdkEvent({ transactionId: "tx-2" })]);
    const sub = subscribeVia({ getChaincodeEvents: async () => events }, "s14");
    const iter = sub.stream[Symbol.asyncIterator]();
    expect((await iter.next()).value?.transactionId).toBe("tx-1");
    sub.close();
    expect(state.closed).toBeGreaterThan(0);
    expect((await iter.next()).done).toBe(true);
  });

  it("close() before the session opens closes it as soon as it opens", async () => {
    const { it: events, state } = iterable([sdkEvent()]);
    const sub = subscribeVia({ getChaincodeEvents: async () => events }, "s14");
    sub.close();
    const got = [];
    for await (const ev of sub.stream) got.push(ev);
    expect(got).toEqual([]);
    expect(state.closed).toBeGreaterThan(0);
  });

  it("a failing subscription surfaces as a stream error", async () => {
    const sub = subscribeVia({ getChaincodeEvents: async () => Promise.reject(new Error("UNAVAILABLE")) }, "s14");
    await expect(sub.stream[Symbol.asyncIterator]().next()).rejects.toThrow(/UNAVAILABLE/);
  });
});
