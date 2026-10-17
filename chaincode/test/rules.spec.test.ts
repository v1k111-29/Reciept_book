/**
 * SPEC for src/rules.ts. OWNER: P2.
 * `it.fails` passes while the stub throws. When you implement checkMilestone, change
 * `it.fails` to `it` for each case: a `fails` test that starts passing turns red on purpose.
 */
import { describe, expect, it } from "vitest";
import { checkMilestone, RuleError } from "../src/rules";
import { DEFAULT_MSP_ROLES, MilestoneEvent, MilestoneSubmission, ShippingBillRecord } from "../src/generated/contracts";

const SB = "a".repeat(64);
const REF = "b".repeat(64);
const rec = (events: Partial<MilestoneEvent>[] = []): ShippingBillRecord => ({
  sb_hash: SB, bank_msp: "Org1MSP", created_ledger_time: "2026-11-01T09:00:00Z",
  events: events.map((e, i) => ({
    sb_hash: SB, occurred_on: "2026-11-01", tx_id: `t${i}`, ledger_time: "2026-11-01T09:00:00Z",
    submitter_msp: "Org1MSP", submitter_role: "AD_BANK", milestone: "PAYMENT_RECEIVED", ...e,
  })) as MilestoneEvent[],
});
const sub = (s: Partial<MilestoneSubmission>): MilestoneSubmission =>
  ({ sb_hash: SB, milestone: "PAYMENT_RECEIVED", occurred_on: "2026-11-01", reference_hash: REF, ...s });
const code = (fn: () => void) => { try { fn(); return "OK"; } catch (e) { return e instanceof RuleError ? e.code : "OTHER"; } };
const R = DEFAULT_MSP_ROLES;

describe("checkMilestone (P2, G2)", () => {
  it.fails("accepts a bank recording payment", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org1MSP", R))).toBe("OK");
  });
  it.fails("rejects the exporters' body recording payment (WRONG_ROLE)", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org2MSP", R))).toBe("WRONG_ROLE");
  });
  it.fails("rejects another bank writing to this record (WRONG_BANK)", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org3MSP", { ...R, Org3MSP: "AD_BANK" }))).toBe("WRONG_BANK");
  });
  it.fails("rejects eBRC before payment (PRECONDITION_FAILED)", () => {
    expect(code(() => checkMilestone(rec(), sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org2MSP", R)))
      .toBe("PRECONDITION_FAILED");
  });
  it.fails("rejects mark-off without documents acknowledged", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EDPMS_MARKED_OFF", reference_hash: null }), "Org1MSP", R)))
      .toBe("PRECONDITION_FAILED");
  });
  it.fails("rejects a second payment milestone (DUPLICATE_MILESTONE)", () => {
    expect(code(() => checkMilestone(rec([{ milestone: "PAYMENT_RECEIVED" }]), sub({}), "Org1MSP", R)))
      .toBe("DUPLICATE_MILESTONE");
  });
  it.fails("allows repeated Customs observations", () => {
    const obs = { milestone: "CUSTOMS_STATUS_OBSERVED" as const, customs_status: "PENDING" as const,
      submitter_msp: "Org2MSP", submitter_role: "EXPORTERS_BODY" as const };
    const s = sub({ milestone: "CUSTOMS_STATUS_OBSERVED", reference_hash: null, customs_status: "REALISED" });
    expect(code(() => checkMilestone(rec([obs]), s, "Org2MSP", R))).toBe("OK");
  });
  it.fails("rejects a submission for a different sb_hash (VALIDATION)", () => {
    expect(code(() => checkMilestone(rec(), sub({ sb_hash: "c".repeat(64) }), "Org1MSP", R))).toBe("VALIDATION");
  });
  it.fails("rejects a missing reference_hash where required (VALIDATION)", () => {
    expect(code(() => checkMilestone(rec(), sub({ reference_hash: null }), "Org1MSP", R))).toBe("VALIDATION");
  });
});
