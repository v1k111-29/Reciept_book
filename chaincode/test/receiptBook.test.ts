/**
 * Unit tests for src/receiptBook.ts with a mocked ctx.stub (no network). OWNER: P2. Task P2-G2-T1.
 */
import { describe, expect, it } from "vitest";
import type { Context } from "fabric-contract-api";
import { ledgerTime, MILESTONE_RECORDED_EVENT, ReceiptBook } from "../src/receiptBook";
import { RuleError } from "../src/rules";
import { MilestoneEvent, MilestoneSubmission, ShippingBillRecord } from "../src/generated/contracts";

const SB = "a".repeat(64);
const REF = "b".repeat(64);
// 2026-11-01T09:00:00.123Z as the proposal timestamp: seconds (a Long in fabric-shim) + nanos.
const TX_SECONDS = 1793523600;
const TX_ISO = "2026-11-01T09:00:00.123Z";

/** A fake ledger shared by several transactions, like one channel's world state. */
function ledger() {
  const state = new Map<string, Uint8Array>();
  const events: { name: string; payload: string }[] = [];
  let puts = 0;
  let n = 0;
  const ctx = (msp: string, seconds: number | { toString(): string } = TX_SECONDS, nanos = 123_456_789) => {
    const txId = `tx${++n}`;
    return {
      clientIdentity: { getMSPID: () => msp },
      stub: {
        getState: async (k: string) => state.get(k) ?? new Uint8Array(0),
        putState: async (k: string, v: Uint8Array) => { puts++; state.set(k, v); },
        getTxID: () => txId,
        getTxTimestamp: () => ({ seconds, nanos }),
        setEvent: (name: string, payload: Uint8Array) => events.push({ name, payload: Buffer.from(payload).toString() }),
      },
    } as unknown as Context;
  };
  const stored = (k: string): ShippingBillRecord => JSON.parse(Buffer.from(state.get(k)!).toString());
  return { ctx, stored, events, puts: () => puts };
}

const cc = new ReceiptBook();
const sub = (s: Partial<MilestoneSubmission> = {}) =>
  JSON.stringify({ sb_hash: SB, milestone: "PAYMENT_RECEIVED", occurred_on: "2026-10-30", reference_hash: REF, ...s });

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; return "OK"; } catch (e) { return e instanceof RuleError ? e.code : `OTHER: ${String(e)}`; }
}

describe("CreateRecord", () => {
  it("creates an empty record owned by the bank that created it", async () => {
    const l = ledger();
    const out = JSON.parse(await cc.CreateRecord(l.ctx("Org1MSP"), SB));
    expect(out).toEqual({ sb_hash: SB, bank_msp: "Org1MSP", created_ledger_time: TX_ISO, events: [] });
    expect(l.stored(SB)).toEqual(out);
  });
  it("rejects the exporters' body (WRONG_ROLE, REQ-p1-24)", async () => {
    expect(await code(cc.CreateRecord(ledger().ctx("Org2MSP"), SB))).toBe("WRONG_ROLE");
  });
  it("rejects an MSP with no role (WRONG_ROLE)", async () => {
    expect(await code(cc.CreateRecord(ledger().ctx("Org9MSP"), SB))).toBe("WRONG_ROLE");
  });
  it("rejects a second record for the same sb_hash (ALREADY_EXISTS)", async () => {
    const l = ledger();
    await cc.CreateRecord(l.ctx("Org1MSP"), SB);
    expect(await code(cc.CreateRecord(l.ctx("Org1MSP"), SB))).toBe("ALREADY_EXISTS");
  });
  it("rejects a malformed sb_hash (VALIDATION)", async () => {
    expect(await code(cc.CreateRecord(ledger().ctx("Org1MSP"), "SB-123"))).toBe("VALIDATION");
  });
});

describe("RecordMilestone", () => {
  it("appends the event, returns it and emits MilestoneRecorded", async () => {
    const l = ledger();
    await cc.CreateRecord(l.ctx("Org1MSP"), SB);
    const ev: MilestoneEvent = JSON.parse(await cc.RecordMilestone(l.ctx("Org1MSP"), sub()));
    expect(ev).toEqual({
      sb_hash: SB, milestone: "PAYMENT_RECEIVED", occurred_on: "2026-10-30", reference_hash: REF,
      customs_status: null, tx_id: "tx2", ledger_time: TX_ISO, submitter_msp: "Org1MSP", submitter_role: "AD_BANK",
    });
    expect(l.stored(SB).events).toEqual([ev]);
    expect(l.events).toEqual([{ name: MILESTONE_RECORDED_EVENT, payload: JSON.stringify(ev) }]);
  });
  it("records the exporters' body as submitter for eBRC", async () => {
    const l = ledger();
    await cc.CreateRecord(l.ctx("Org1MSP"), SB);
    await cc.RecordMilestone(l.ctx("Org1MSP"), sub());
    const ev = JSON.parse(await cc.RecordMilestone(l.ctx("Org2MSP"), sub({ milestone: "EBRC_SELF_CERTIFIED" })));
    expect([ev.submitter_msp, ev.submitter_role]).toEqual(["Org2MSP", "EXPORTERS_BODY"]);
    expect(l.stored(SB).events.map((e) => e.milestone)).toEqual(["PAYMENT_RECEIVED", "EBRC_SELF_CERTIFIED"]);
  });
  it("rejects a missing record (NOT_FOUND, REQ-p1-1)", async () => {
    expect(await code(cc.RecordMilestone(ledger().ctx("Org1MSP"), sub()))).toBe("NOT_FOUND");
  });
  it("rejects input that is not JSON (VALIDATION)", async () => {
    expect(await code(cc.RecordMilestone(ledger().ctx("Org1MSP"), "{not json"))).toBe("VALIDATION");
  });
  it("rejects a malformed submission before reading state (VALIDATION)", async () => {
    expect(await code(cc.RecordMilestone(ledger().ctx("Org1MSP"), sub({ occurred_on: "30/10/2026" })))).toBe("VALIDATION");
  });
  it("passes rule errors through and writes nothing", async () => {
    const l = ledger();
    await cc.CreateRecord(l.ctx("Org1MSP"), SB);
    const before = l.puts();
    expect(await code(cc.RecordMilestone(l.ctx("Org2MSP"), sub()))).toBe("WRONG_ROLE");
    expect(await code(cc.RecordMilestone(l.ctx("Org2MSP"), sub({ milestone: "EBRC_SELF_CERTIFIED" })))).toBe("PRECONDITION_FAILED");
    expect(l.puts()).toBe(before);
    expect(l.events).toEqual([]);
    expect(l.stored(SB).events).toEqual([]);
  });
  it("puts the code first in the error message, as the gateway expects (D-21)", async () => {
    await expect(cc.RecordMilestone(ledger().ctx("Org1MSP"), sub())).rejects.toThrow(/^NOT_FOUND: /);
  });
});

describe("GetRecord", () => {
  it("returns the stored record", async () => {
    const l = ledger();
    const created = await cc.CreateRecord(l.ctx("Org1MSP"), SB);
    expect(await cc.GetRecord(l.ctx("Org2MSP"), SB)).toBe(created);
  });
  it("rejects a missing record (NOT_FOUND)", async () => {
    expect(await code(cc.GetRecord(ledger().ctx("Org1MSP"), SB))).toBe("NOT_FOUND");
  });
  it("rejects a malformed sb_hash (VALIDATION)", async () => {
    expect(await code(cc.GetRecord(ledger().ctx("Org1MSP"), "x"))).toBe("VALIDATION");
  });
});

describe("ledger_time (ISS-p2-2, U-12)", () => {
  it("is the proposal timestamp as ISO 8601 UTC with Z, with a Long-like seconds value", () => {
    const longLike = { toString: () => String(TX_SECONDS) }; // fabric-shim returns seconds as a Long
    expect(ledgerTime(ledger().ctx("Org1MSP", longLike))).toBe(TX_ISO);
  });
  it("comes from the transaction, not the peer's clock: a 2001 proposal gives a 2001 ledger_time", async () => {
    const l = ledger();
    const rec = JSON.parse(await cc.CreateRecord(l.ctx("Org1MSP", 1_000_000_000, 0), SB));
    expect(rec.created_ledger_time).toBe("2001-09-09T01:46:40.000Z");
  });
});
