/**
 * Extra cases for src/rules.ts beyond the 9 specs in rules.spec.test.ts. OWNER: P2.
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
const customs = (s: Partial<MilestoneSubmission> = {}) =>
  sub({ milestone: "CUSTOMS_STATUS_OBSERVED", reference_hash: null, customs_status: "PENDING", ...s });

describe("checkMilestone: VALIDATION", () => {
  it("rejects an sb_hash that is not HASH_PATTERN, even if it matches the record", () => {
    const bad = "A".repeat(64);
    expect(code(() => checkMilestone({ ...rec(), sb_hash: bad }, sub({ sb_hash: bad }), "Org1MSP", R))).toBe("VALIDATION");
  });
  it("rejects a reference_hash that is not HASH_PATTERN", () => {
    expect(code(() => checkMilestone(rec(), sub({ reference_hash: "1234" }), "Org1MSP", R))).toBe("VALIDATION");
  });
  it("accepts an optional reference_hash on mark-off when it is a valid hash", () => {
    const r = rec([{ milestone: "DOCS_ACKNOWLEDGED" }, { milestone: "PAYMENT_RECEIVED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EDPMS_MARKED_OFF" }), "Org1MSP", R))).toBe("OK");
  });
  it("treats an absent reference_hash like null", () => {
    const s = sub({});
    delete s.reference_hash;
    expect(code(() => checkMilestone(rec(), s, "Org1MSP", R))).toBe("VALIDATION");
  });
  it("rejects a customs observation without customs_status", () => {
    expect(code(() => checkMilestone(rec(), customs({ customs_status: null }), "Org2MSP", R))).toBe("VALIDATION");
  });
  it("rejects customs_status on any other milestone", () => {
    expect(code(() => checkMilestone(rec(), sub({ customs_status: "REALISED" }), "Org1MSP", R))).toBe("VALIDATION");
  });
  it("rejects an unknown customs_status", () => {
    const s = customs({ customs_status: "LOST" as never });
    expect(code(() => checkMilestone(rec(), s, "Org2MSP", R))).toBe("VALIDATION");
  });
  it("rejects an unknown milestone", () => {
    expect(code(() => checkMilestone(rec(), sub({ milestone: "SHIPPED" as never }), "Org1MSP", R))).toBe("VALIDATION");
  });
  it.each(["2026-13-01", "2026-02-30", "01-11-2026", "2026-11-01T00:00:00Z", ""])(
    "rejects occurred_on %j",
    (d) => {
      expect(code(() => checkMilestone(rec(), sub({ occurred_on: d }), "Org1MSP", R))).toBe("VALIDATION");
    },
  );
  it("checks VALIDATION before WRONG_ROLE", () => {
    expect(code(() => checkMilestone(rec(), sub({ reference_hash: null }), "Org2MSP", R))).toBe("VALIDATION");
  });
});

describe("checkMilestone: WRONG_ROLE", () => {
  it("rejects a submitter MSP missing from mspRoles", () => {
    expect(code(() => checkMilestone(rec(), sub({}), "Org9MSP", R))).toBe("WRONG_ROLE");
  });
  it("rejects an unknown MSP even for a milestone with no writer bank check", () => {
    expect(code(() => checkMilestone(rec(), customs(), "Org9MSP", R))).toBe("WRONG_ROLE");
  });
  it("rejects a CUSTOMS_VIEWER writing a customs observation", () => {
    expect(code(() => checkMilestone(rec(), customs(), "Org3MSP", { ...R, Org3MSP: "CUSTOMS_VIEWER" }))).toBe("WRONG_ROLE");
  });
  it("rejects the bank writing a customs observation", () => {
    expect(code(() => checkMilestone(rec(), customs(), "Org1MSP", R))).toBe("WRONG_ROLE");
  });
  it("checks WRONG_ROLE before PRECONDITION_FAILED", () => {
    expect(code(() => checkMilestone(rec(), sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org1MSP", R))).toBe("WRONG_ROLE");
  });
});

describe("checkMilestone: WRONG_BANK, DUPLICATE_MILESTONE, PRECONDITION_FAILED", () => {
  it("lets any EXPORTERS_BODY MSP write exporter milestones (bank rule is AD_BANK only)", () => {
    expect(code(() => checkMilestone(rec(), customs(), "Org4MSP", { ...R, Org4MSP: "EXPORTERS_BODY" }))).toBe("OK");
  });
  it("checks WRONG_BANK before DUPLICATE_MILESTONE", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }]);
    expect(code(() => checkMilestone(r, sub({}), "Org3MSP", { ...R, Org3MSP: "AD_BANK" }))).toBe("WRONG_BANK");
  });
  it("checks DUPLICATE_MILESTONE before PRECONDITION_FAILED", () => {
    const r = rec([{ milestone: "EDPMS_MARKED_OFF" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EDPMS_MARKED_OFF", reference_hash: null }), "Org1MSP", R)))
      .toBe("DUPLICATE_MILESTONE");
  });
  it("rejects mark-off without payment", () => {
    const r = rec([{ milestone: "DOCS_ACKNOWLEDGED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EDPMS_MARKED_OFF", reference_hash: null }), "Org1MSP", R)))
      .toBe("PRECONDITION_FAILED");
  });
  it("accepts eBRC by the exporters' body after payment", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org2MSP", R))).toBe("OK");
  });
  it("rejects a second eBRC", () => {
    const r = rec([{ milestone: "PAYMENT_RECEIVED" }, { milestone: "EBRC_SELF_CERTIFIED", submitter_msp: "Org2MSP" }]);
    expect(code(() => checkMilestone(r, sub({ milestone: "EBRC_SELF_CERTIFIED" }), "Org2MSP", R))).toBe("DUPLICATE_MILESTONE");
  });
  it("accepts documents acknowledged with no other milestone", () => {
    expect(code(() => checkMilestone(rec(), sub({ milestone: "DOCS_ACKNOWLEDGED" }), "Org1MSP", R))).toBe("OK");
  });
});

describe("RuleError", () => {
  it("formats the message as '<ErrorCode>: message'", () => {
    try {
      checkMilestone(rec(), sub({}), "Org2MSP", R);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(RuleError);
      expect((e as RuleError).message).toMatch(/^WRONG_ROLE: \S/);
    }
  });
});
