/**
 * SPEC for src/rules.ts. OWNER: P2.
 * The first 9 cases are the G0 spec (P2-G1-T1: changed from `it.fails` to `it`).
 * The cases after them pin the rules the contract leaves to the chaincode (ISS-p2-5 to 7)
 * and the check order (ISS-p2-3).
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

describe("checkMilestone (P2, G1)", () => {
  it("accepts a bank recording payment", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org1MSP", R))).toBe("OK");
  });
  it("rejects the exporters' body recording payment (WRONG_ROLE)", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org2MSP", R))).toBe("WRONG_ROLE");
  });
  it("rejects another bank writing to this record (WRONG_BANK)", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org3MSP", { ...R, Org3MSP: "AD_BANK" }))).toBe("WRONG_BANK");
  });
  it("rejects eBRC before payment (PRECONDITION_FAILED)", () => {
    expect(code(() => checkMilestone(rec(), sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org2MSP", R)))
      .toBe("PRECONDITION_FAILED");
  });
  it("rejects mark-off without documents acknowledged", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EDPMS_MARKED_OFF", reference_hash: null }), "Org1MSP", R)))
      .toBe("PRECONDITION_FAILED");
  });
  it("rejects a second payment milestone (DUPLICATE_MILESTONE)", () => {
    expect(code(() => checkMilestone(rec([{ milestone: "PAYMENT_RECEIVED" }]), sub({}), "Org1MSP", R)))
      .toBe("DUPLICATE_MILESTONE");
  });
  it("allows repeated Customs observations", () => {
    const obs = { milestone: "CUSTOMS_STATUS_OBSERVED" as const, customs_status: "PENDING" as const,
      submitter_msp: "Org2MSP", submitter_role: "EXPORTERS_BODY" as const };
    const s = sub({ milestone: "CUSTOMS_STATUS_OBSERVED", reference_hash: null, customs_status: "REALISED" });
    expect(code(() => checkMilestone(rec([obs]), s, "Org2MSP", R))).toBe("OK");
  });
  it("rejects a submission for a different sb_hash (VALIDATION)", () => {
    expect(code(() => checkMilestone(rec(), sub({ sb_hash: "c".repeat(64) }), "Org1MSP", R))).toBe("VALIDATION");
  });
  it("rejects a missing reference_hash where required (VALIDATION)", () => {
    expect(code(() => checkMilestone(rec(), sub({ reference_hash: null }), "Org1MSP", R))).toBe("VALIDATION");
  });
});

describe("checkMilestone: rules left to the chaincode (ISS-p2-3, 5, 6, 7)", () => {
  it("rejects an MSP with no role (WRONG_ROLE, ISS-p2-5)", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org9MSP", R))).toBe("WRONG_ROLE");
  });
  it("rejects a customs viewer writing anything (WRONG_ROLE)", () => {
    const s = sub({ milestone: "CUSTOMS_STATUS_OBSERVED", reference_hash: null, customs_status: "PENDING" });
    expect(code(() => checkMilestone(rec(), s, "Org3MSP", { ...R, Org3MSP: "CUSTOMS_VIEWER" }))).toBe("WRONG_ROLE");
  });
  it("lets the exporters' body write eBRC after payment (not a bank milestone, ISS-p2-7)", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org2MSP", R))).toBe("OK");
  });
  it("rejects another bank's mark-off (WRONG_BANK applies to every bank milestone, ISS-p2-7)", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }, { milestone: "DOCS_ACKNOWLEDGED" }]);
    const s = sub({ milestone: "EDPMS_MARKED_OFF", reference_hash: null });
    expect(code(() => checkMilestone(r, s, "Org3MSP", { ...R, Org3MSP: "AD_BANK" }))).toBe("WRONG_BANK");
  });
  it("accepts mark-off once docs and payment are on the record", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }, { milestone: "DOCS_ACKNOWLEDGED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EDPMS_MARKED_OFF", reference_hash: null }), "Org1MSP", R)))
      .toBe("OK");
  });
  it("checks role before duplicates (ISS-p2-3)", () => {
    expect(code(() => checkMilestone(rec([{ milestone: "PAYMENT_RECEIVED" }]), sub({}), "Org2MSP", R)))
      .toBe("WRONG_ROLE");
  });
  it("checks duplicates before preconditions (ISS-p2-3)", () => {
    const r = rec([{ milestone: "EBRC_SELF_CERTIFIED", submitter_msp: "Org2MSP", submitter_role: "EXPORTERS_BODY" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org2MSP", R)))
      .toBe("DUPLICATE_MILESTONE");
  });
  it.each([
    ["an unknown field", { note: "x" }],
    ["an unknown milestone", { milestone: "SHIPPED" }],
    ["an impossible date", { occurred_on: "2026-02-30" }],
    ["a date with a time", { occurred_on: "2026-11-01T10:00:00Z" }],
    ["an uppercase reference_hash", { reference_hash: "B".repeat(64) }],
    ["a bad sb_hash", { sb_hash: "xyz" }],
    ["customs_status on a non-customs milestone", { customs_status: "PENDING" }],
    ["a customs observation without customs_status", { milestone: "CUSTOMS_STATUS_OBSERVED", reference_hash: null }],
    ["an unknown customs_status", { milestone: "CUSTOMS_STATUS_OBSERVED", reference_hash: null, customs_status: "LOST" }],
  ])("rejects %s (VALIDATION, ISS-p2-6)", (_label, patch) => {
    const s = { ...sub({}), ...patch } as MilestoneSubmission;
    expect(code(() => checkMilestone(rec(), s, "Org2MSP", R))).toBe("VALIDATION");
  });
  it("rejects a submission that is not an object (VALIDATION)", () => {
    expect(code(() => checkMilestone(rec(), null as unknown as MilestoneSubmission, "Org1MSP", R))).toBe("VALIDATION");
  });
});
