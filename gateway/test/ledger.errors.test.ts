/** Error mapping of src/ledger/errors.ts (D-21, REQ-p1-30, REQ-p1-33). OWNER: P3. */
import { describe, expect, it } from "vitest";
import { toErrorResult } from "../src/ledger/errors";

const peer = (msg: string) => `chaincode response 500, ${msg}`;

describe("endorsement failures (chaincode errors)", () => {
  it("reads the ErrorCode after 'chaincode response 500, ' and keeps the chaincode's text", () => {
    const r = toErrorResult({ kind: "endorse", txId: "t1", messages: [peer("PRECONDITION_FAILED: needs PAYMENT_RECEIVED")] });
    expect(r).toEqual({
      status: 409,
      result: { ok: false, tx_id: "t1", error: { code: "PRECONDITION_FAILED", message: "PRECONDITION_FAILED: needs PAYMENT_RECEIVED" } },
    });
  });

  it("uses the code when both peers agree", () => {
    const r = toErrorResult({ kind: "endorse", messages: [peer("ALREADY_EXISTS: x"), peer("ALREADY_EXISTS: x")] });
    expect([r.status, r.result.error?.code]).toEqual([409, "ALREADY_EXISTS"]);
  });

  it("gives ENDORSEMENT_FAILED when peers report different codes", () => {
    const r = toErrorResult({ kind: "endorse", messages: [peer("WRONG_ROLE: a"), peer("NOT_FOUND: b")] });
    expect([r.status, r.result.error?.code]).toEqual([502, "ENDORSEMENT_FAILED"]);
  });

  it.each([
    ["an unknown code", peer("TEAPOT: short and stout")],
    ["no code", peer("The asset asset70 does not exist")],
    ["no chaincode prefix", "some gRPC failure"],
  ])("gives INTERNAL for %s", (_name, message) => {
    const r = toErrorResult({ kind: "endorse", messages: [message] });
    expect([r.status, r.result.error?.code]).toEqual([500, "INTERNAL"]);
  });

  it("gives INTERNAL with a message when there are no details", () => {
    const r = toErrorResult({ kind: "endorse", messages: [] });
    expect(r.result.error).toEqual({ code: "INTERNAL", message: "endorsement failed with no details" });
  });

  it("leaves tx_id null when none is known", () => {
    expect(toErrorResult({ kind: "endorse", messages: [peer("WRONG_BANK: x")] }).result.tx_id).toBeNull();
  });
});

describe("commit failures", () => {
  it.each([
    ["MVCC_READ_CONFLICT", 409, "MVCC_CONFLICT"],
    ["ENDORSEMENT_POLICY_FAILURE", 502, "ENDORSEMENT_FAILED"],
    ["PHANTOM_READ_CONFLICT", 500, "INTERNAL"],
  ])("maps commit code %s to %s %s, with the tx id", (commitCode, status, code) => {
    const r = toErrorResult({ kind: "commit", commitCode, txId: "t9" });
    expect([r.status, r.result.error?.code, r.result.tx_id]).toEqual([status, code, "t9"]);
  });
});

describe("other failures", () => {
  it("gives OUTCOME_UNKNOWN 504 and always carries the tx id (D-20)", () => {
    const r = toErrorResult({ kind: "outcome_unknown", txId: "t5" });
    expect([r.status, r.result.error?.code, r.result.tx_id]).toEqual([504, "OUTCOME_UNKNOWN", "t5"]);
  });

  it("gives LEDGER_UNAVAILABLE 503, with the tx id when one is known", () => {
    const r = toErrorResult({ kind: "unavailable", message: "orderer down", txId: "t6" });
    expect([r.status, r.result.error?.code, r.result.tx_id]).toEqual([503, "LEDGER_UNAVAILABLE", "t6"]);
  });
});
