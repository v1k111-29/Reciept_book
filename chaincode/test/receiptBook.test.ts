/**
 * Unit tests for src/receiptBook.ts with a mocked ctx.stub (no network). OWNER: P2.
 * Tasks P2-G2-T1 (CreateRecord, RecordMilestone, GetRecord) and P2-G3-T1 (each milestone, ListRecords).
 */
import { describe, expect, it } from "vitest";
import type { Context } from "fabric-contract-api";
import { ledgerTime, MILESTONE_RECORDED_EVENT, ReceiptBook } from "../src/receiptBook";
import { RuleError } from "../src/rules";
import {
  MilestoneEvent, MilestoneSubmission, PRECONDITIONS, REFERENCE_REQUIRED, REPEATABLE, ShippingBillRecord, WRITER_ROLE,
} from "../src/generated/contracts";

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
  let closed = 0;
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
        // Like fabric-shim: {value: {key, value}, done: false} per key in key order, then {done: true}.
        getStateByRange: async (start: string, end: string) => {
          const keys = [...state.keys()].filter((k) => k >= start && (end === "" || k < end)).sort();
          let i = 0;
          return {
            next: async () => (i < keys.length
              ? { value: { key: keys[i], value: Buffer.from(state.get(keys[i++])!) }, done: false }
              : { done: true }),
            close: async () => { closed++; },
          };
        },
      },
    } as unknown as Context;
  };
  const stored = (k: string): ShippingBillRecord => JSON.parse(Buffer.from(state.get(k)!).toString());
  /** Put a record straight into state, e.g. one created by another bank. */
  const seed = (r: ShippingBillRecord) => state.set(r.sb_hash, Buffer.from(JSON.stringify(r)));
  return { ctx, stored, seed, events, puts: () => puts, closed: () => closed };
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

// ------------------------------------------------------------------ G3 (P2-G3-T1)

type M = MilestoneSubmission["milestone"];
/** A valid submission for milestone `m`: reference only where REFERENCE_REQUIRED, PENDING for Customs. */
const subFor = (m: M, s: Partial<MilestoneSubmission> = {}) => sub({
  milestone: m,
  reference_hash: REFERENCE_REQUIRED.includes(m) ? REF : null,
  customs_status: m === "CUSTOMS_STATUS_OBSERVED" ? "PENDING" : null,
  ...s,
});
const MSP_OF: Record<string, string> = { AD_BANK: "Org1MSP", EXPORTERS_BODY: "Org2MSP" };
const writerOf = (m: M) => MSP_OF[WRITER_ROLE[m]];
const otherOf = (m: M) => (writerOf(m) === "Org1MSP" ? "Org2MSP" : "Org1MSP");

/** A ledger with a record created by Org1 and `before` already recorded by their writers. */
async function withRecord(before: readonly M[] = []) {
  const l = ledger();
  await cc.CreateRecord(l.ctx("Org1MSP"), SB);
  for (const m of before) await cc.RecordMilestone(l.ctx(writerOf(m)), subFor(m));
  return l;
}

const ALL: M[] = ["DOCS_ACKNOWLEDGED", "PAYMENT_RECEIVED", "EBRC_SELF_CERTIFIED", "EDPMS_MARKED_OFF", "CUSTOMS_STATUS_OBSERVED"];

describe.each(ALL)("RecordMilestone %s (E2)", (m) => {
  const needs = PRECONDITIONS[m];
  const bank = WRITER_ROLE[m] === "AD_BANK";

  it(`is recorded by ${WRITER_ROLE[m]} with the submitter, reference and customs_status`, async () => {
    const l = await withRecord(needs);
    const ev: MilestoneEvent = JSON.parse(await cc.RecordMilestone(l.ctx(writerOf(m)), subFor(m)));
    expect(ev).toMatchObject({
      milestone: m, submitter_msp: writerOf(m), submitter_role: WRITER_ROLE[m],
      reference_hash: REFERENCE_REQUIRED.includes(m) ? REF : null,
      customs_status: m === "CUSTOMS_STATUS_OBSERVED" ? "PENDING" : null,
    });
    expect(l.stored(SB).events.map((e) => e.milestone)).toEqual([...needs, m]);
  });

  it("rejects the other org (WRONG_ROLE) and writes nothing", async () => {
    const l = await withRecord(needs);
    expect(await code(cc.RecordMilestone(l.ctx(otherOf(m)), subFor(m)))).toBe("WRONG_ROLE");
    expect(l.stored(SB).events).toHaveLength(needs.length);
  });

  if (bank) {
    it("rejects a bank that did not create the record (WRONG_BANK)", async () => {
      const l = ledger();
      const prior = needs.map((p, i) => ({
        sb_hash: SB, milestone: p, occurred_on: "2026-10-01", reference_hash: REF, customs_status: null,
        tx_id: `old${i}`, ledger_time: TX_ISO, submitter_msp: "Org3MSP", submitter_role: "AD_BANK" as const,
      }));
      l.seed({ sb_hash: SB, bank_msp: "Org3MSP", created_ledger_time: TX_ISO, events: prior });
      expect(await code(cc.RecordMilestone(l.ctx("Org1MSP"), subFor(m)))).toBe("WRONG_BANK");
      expect(l.stored(SB).events).toHaveLength(needs.length);
    });
  }

  for (const missing of needs) {
    it(`needs ${missing} first (PRECONDITION_FAILED)`, async () => {
      const l = await withRecord(needs.filter((p) => p !== missing));
      expect(await code(cc.RecordMilestone(l.ctx(writerOf(m)), subFor(m)))).toBe("PRECONDITION_FAILED");
    });
  }

  if (REPEATABLE.includes(m)) {
    it("can be recorded again (REPEATABLE)", async () => {
      const l = await withRecord([...needs, m]);
      await cc.RecordMilestone(l.ctx(writerOf(m)), subFor(m, { customs_status: "REALISED" }));
      expect(l.stored(SB).events.map((e) => e.customs_status)).toEqual(["PENDING", "REALISED"]);
    });
  } else {
    it("cannot be recorded twice (DUPLICATE_MILESTONE)", async () => {
      const l = await withRecord([...needs, m]);
      expect(await code(cc.RecordMilestone(l.ctx(writerOf(m)), subFor(m)))).toBe("DUPLICATE_MILESTONE");
    });
  }
});

describe("all five milestones in order (as tests/integration expects)", () => {
  it("records the full journey with one event per write, each by its writer", async () => {
    const l = await withRecord();
    const steps: [M, "PENDING" | "REALISED" | null][] = [
      ["DOCS_ACKNOWLEDGED", null], ["PAYMENT_RECEIVED", null], ["EBRC_SELF_CERTIFIED", null],
      ["EDPMS_MARKED_OFF", null], ["CUSTOMS_STATUS_OBSERVED", "PENDING"], ["CUSTOMS_STATUS_OBSERVED", "REALISED"],
    ];
    const txIds: string[] = [];
    for (const [m, status] of steps) {
      const ev = JSON.parse(await cc.RecordMilestone(l.ctx(writerOf(m)), subFor(m, { customs_status: status })));
      txIds.push(ev.tx_id);
    }
    const events = l.stored(SB).events;
    expect(events.map((e) => [e.milestone, e.customs_status])).toEqual(steps);
    expect(events.map((e) => e.tx_id)).toEqual(txIds);
    expect(new Set(txIds).size).toBe(txIds.length);
    for (const e of events) expect(e.submitter_role).toBe(WRITER_ROLE[e.milestone]);
    expect(l.events.map((e) => JSON.parse(e.payload).milestone)).toEqual(steps.map(([m]) => m));
  });
});

describe("ListRecords", () => {
  it("returns [] on an empty ledger", async () => {
    expect(JSON.parse(await cc.ListRecords(ledger().ctx("Org1MSP")))).toEqual([]);
  });
  it("returns every record, with its events, in sb_hash order, for either org", async () => {
    const l = ledger();
    const [A, B] = ["a".repeat(64), "f".repeat(64)];
    await cc.CreateRecord(l.ctx("Org1MSP"), B);
    await cc.CreateRecord(l.ctx("Org1MSP"), A);
    await cc.RecordMilestone(l.ctx("Org1MSP"), sub({ sb_hash: B }));
    const list: ShippingBillRecord[] = JSON.parse(await cc.ListRecords(l.ctx("Org2MSP")));
    expect(list.map((r) => r.sb_hash)).toEqual([A, B]);
    expect(list).toEqual([l.stored(A), l.stored(B)]);
    expect(list[1].events.map((e) => e.milestone)).toEqual(["PAYMENT_RECEIVED"]);
  });
  it("skips keys that are not sb_hashes and closes the iterator", async () => {
    const l = await withRecord();
    l.seed({ sb_hash: "not-a-record", bank_msp: "x", created_ledger_time: TX_ISO, events: [] });
    const list: ShippingBillRecord[] = JSON.parse(await cc.ListRecords(l.ctx("Org1MSP")));
    expect(list.map((r) => r.sb_hash)).toEqual([SB]);
    expect(l.closed()).toBe(1);
  });
});
