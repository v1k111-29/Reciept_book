/** Fabric error conversion and submit flow of src/ledger/fabric.ts, without a network. OWNER: P3. */
import { describe, expect, it } from "vitest";
import { status as grpcStatus, type ServiceError } from "@grpc/grpc-js";
import { CommitStatusError, EndorseError, GatewayError } from "@hyperledger/fabric-gateway";
import { evaluateVia, FabricLedger, isEndorseMismatch, MISMATCH_RETRY, statusName, submitVia, toLedgerFailure } from "../src/ledger/fabric";
import { toErrorResult } from "../src/ledger/errors";
import { LedgerError } from "../src/ledger/types";

const cause = new Error("grpc") as ServiceError;
const detail = (message: string) => ({ address: "peer0.org1.example.com:7051", mspId: "Org1MSP", message });
const endorseError = (code: number, details: ReturnType<typeof detail>[]) =>
  new EndorseError({ code, details, cause, transactionId: "tx-e", message: `${code} endorse failed` });
const gatewayError = (code: number, details: ReturnType<typeof detail>[], name = "GatewayError") =>
  Object.assign(new GatewayError({ code, details, cause, message: `${code} failed` }), { name });
const submitError = (code: number) => Object.assign(gatewayError(code, [], "SubmitError"), { transactionId: "tx-s" });

describe("toLedgerFailure", () => {
  it("EndorseError with details -> endorse with the peers' messages and the tx id", () => {
    const f = toLedgerFailure(endorseError(grpcStatus.ABORTED, [detail("chaincode response 500, WRONG_ROLE: x")]));
    expect(f).toEqual({ kind: "endorse", messages: ["chaincode response 500, WRONG_ROLE: x"], txId: "tx-e" });
  });

  it.each([grpcStatus.UNAVAILABLE, grpcStatus.DEADLINE_EXCEEDED])("EndorseError code %i, no details -> unavailable", (code) => {
    expect(toLedgerFailure(endorseError(code, []))).toMatchObject({ kind: "unavailable", txId: "tx-e" });
  });

  it("EndorseError with another code and no details -> endorse with its message", () => {
    expect(toLedgerFailure(endorseError(grpcStatus.INTERNAL, []))).toMatchObject({ kind: "endorse", messages: ["13 endorse failed"] });
  });

  it("SubmitError UNAVAILABLE -> unavailable (not ordered)", () => {
    expect(toLedgerFailure(submitError(grpcStatus.UNAVAILABLE))).toMatchObject({ kind: "unavailable", txId: "tx-s" });
  });

  it.each([grpcStatus.DEADLINE_EXCEEDED, grpcStatus.UNKNOWN])("SubmitError code %i -> outcome_unknown (may be ordered)", (code) => {
    expect(toLedgerFailure(submitError(code))).toEqual({ kind: "outcome_unknown", txId: "tx-s" });
  });

  it("CommitStatusError -> outcome_unknown with the tx id", () => {
    const err = new CommitStatusError({ code: grpcStatus.DEADLINE_EXCEEDED, details: [], cause, transactionId: "tx-c" });
    expect(toLedgerFailure(err)).toEqual({ kind: "outcome_unknown", txId: "tx-c" });
  });

  it("GatewayError (evaluate) with details -> endorse, no tx id", () => {
    expect(toLedgerFailure(gatewayError(grpcStatus.ABORTED, [detail("chaincode response 500, NOT_FOUND: y")]))).toEqual({
      kind: "endorse",
      messages: ["chaincode response 500, NOT_FOUND: y"],
      txId: undefined,
    });
  });

  it("GatewayError UNAVAILABLE without details -> unavailable", () => {
    expect(toLedgerFailure(gatewayError(grpcStatus.UNAVAILABLE, []))).toMatchObject({ kind: "unavailable" });
  });

  it("anything that isn't a Fabric error -> undefined (the server answers INTERNAL)", () => {
    expect(toLedgerFailure(new TypeError("boom"))).toBeUndefined();
    expect(toLedgerFailure("nope")).toBeUndefined();
  });
});

describe("submit and evaluate flow", () => {
  const submitted = (code: number, successful = code === 0) => ({
    getResult: () => new TextEncoder().encode('{"ok":1}'),
    getStatus: async () => ({ code, successful, transactionId: "tx-1", blockNumber: 7n }),
  });
  const contract = (impl: Partial<Record<"submitAsync" | "evaluateTransaction", (...a: any[]) => Promise<any>>>) =>
    ({ submitAsync: impl.submitAsync, evaluateTransaction: impl.evaluateTransaction }) as any;

  it("returns the tx id and the raw result when the commit is valid", async () => {
    const c = contract({ submitAsync: async () => submitted(0) });
    await expect(submitVia(c, "CreateRecord", ["a"])).resolves.toEqual({ txId: "tx-1", result: '{"ok":1}' });
  });

  it.each([
    [11, "MVCC_READ_CONFLICT"],
    [10, "ENDORSEMENT_POLICY_FAILURE"],
  ])("turns commit code %i into a commit failure named %s", async (code, name) => {
    const c = contract({ submitAsync: async () => submitted(code) });
    const err = await submitVia(c, "CreateRecord", ["a"]).catch((e) => e);
    expect(err).toBeInstanceOf(LedgerError);
    expect(err.failure).toEqual({ kind: "commit", commitCode: name, txId: "tx-1" });
  });

  it("turns a CommitStatusError from getStatus into outcome_unknown", async () => {
    const c = contract({
      submitAsync: async () => ({
        ...submitted(0),
        getStatus: async () => {
          throw new CommitStatusError({ code: 4, details: [], cause, transactionId: "tx-9" });
        },
      }),
    });
    const err = await submitVia(c, "RecordMilestone", ["{}"]).catch((e) => e);
    expect(err.failure).toEqual({ kind: "outcome_unknown", txId: "tx-9" });
  });

  describe("retry of an endorsement whose peers' results differ (ISS-p3-10)", () => {
    const mismatch = () => endorseError(grpcStatus.ABORTED, [detail("ProposalResponsePayloads do not match")]);
    const fast = { ...MISMATCH_RETRY, waitMs: 0 };
    /** submitAsync that runs the given steps in turn: an Error is thrown, anything else is returned. */
    const scripted = (...steps: unknown[]) => {
      let calls = 0;
      const submitAsync = async () => {
        const step = steps[Math.min(calls++, steps.length - 1)];
        if (step instanceof Error) throw step;
        return step;
      };
      return { c: contract({ submitAsync }), calls: () => calls };
    };

    it("retries a mismatch with a new proposal and returns the second attempt's result", async () => {
      const s = scripted(mismatch(), submitted(0));
      await expect(submitVia(s.c, "RecordMilestone", ["{}"])).resolves.toEqual({ txId: "tx-1", result: '{"ok":1}' });
      expect(s.calls()).toBe(2);
    });

    it("matches the peer text case-insensitively", () => {
      expect(isEndorseMismatch(endorseError(grpcStatus.ABORTED, [detail("proposalresponsepayloads DO NOT MATCH")]))).toBe(true);
    });

    it("gives up after exactly 3 attempts and keeps today's INTERNAL result", async () => {
      const s = scripted(mismatch());
      const err = await submitVia(s.c, "RecordMilestone", ["{}"], fast).catch((e) => e);
      expect(s.calls()).toBe(3);
      expect(err.failure).toEqual({ kind: "endorse", messages: ["ProposalResponsePayloads do not match"], txId: "tx-e" });
      expect(toErrorResult(err.failure).result.error).toEqual({ code: "INTERNAL", message: "ProposalResponsePayloads do not match" });
    });

    it("stops retrying once the time budget is spent", async () => {
      const s = scripted(mismatch());
      await submitVia(s.c, "RecordMilestone", ["{}"], { ...fast, budgetMs: -1 }).catch(() => undefined);
      expect(s.calls()).toBe(1);
    });

    it.each([
      ["another endorse failure", endorseError(grpcStatus.ABORTED, [detail("chaincode response 500, WRONG_ROLE: x")])],
      ["an unreachable endorser", endorseError(grpcStatus.UNAVAILABLE, [])],
      ["a GatewayError with the mismatch text", gatewayError(grpcStatus.ABORTED, [detail("ProposalResponsePayloads do not match")])],
      ["a SubmitError (may be ordered)", submitError(grpcStatus.DEADLINE_EXCEEDED)],
    ])("does not retry %s", async (_name, error) => {
      const s = scripted(error, submitted(0));
      await expect(submitVia(s.c, "RecordMilestone", ["{}"], fast)).rejects.toBeInstanceOf(LedgerError);
      expect(s.calls()).toBe(1);
    });

    it("does not retry a commit failure", async () => {
      const s = scripted(submitted(11), submitted(0));
      const err = await submitVia(s.c, "RecordMilestone", ["{}"], fast).catch((e) => e);
      expect([err.failure.kind, s.calls()]).toEqual(["commit", 1]);
    });

    it("does not retry an unknown commit status (OUTCOME_UNKNOWN)", async () => {
      const unknown = {
        ...submitted(0),
        getStatus: async () => {
          throw new CommitStatusError({ code: 4, details: [], cause, transactionId: "tx-9" });
        },
      };
      const s = scripted(unknown, submitted(0));
      const err = await submitVia(s.c, "RecordMilestone", ["{}"], fast).catch((e) => e);
      expect([err.failure.kind, s.calls()]).toEqual(["outcome_unknown", 1]);
    });
  });

  it("evaluate decodes the result and converts Fabric errors", async () => {
    await expect(evaluateVia(contract({ evaluateTransaction: async () => new TextEncoder().encode("[]") }), "ListRecords", [])).resolves.toBe("[]");
    const failing = contract({ evaluateTransaction: async () => Promise.reject(gatewayError(grpcStatus.UNAVAILABLE, [])) });
    expect((await evaluateVia(failing, "ListRecords", []).catch((e) => e)).failure.kind).toBe("unavailable");
  });

  it("names validation codes", () => {
    expect([statusName(0), statusName(11), statusName(999)]).toEqual(["VALID", "MVCC_READ_CONFLICT", "UNKNOWN_STATUS_999"]);
  });
});

describe("FabricLedger.connect", () => {
  const id = { mspId: "Org1MSP", peerEndpoint: "localhost:1", tlsCertPath: "/nope/ca.crt", certPath: "/nope/cert.pem", keyPath: "/nope/key" };

  it("fails at startup and names the missing file", async () => {
    const config = { port: 8800, channel: "receiptbook", chaincode: "receiptbook", identities: { AD_BANK: id } };
    await expect(FabricLedger.connect(config)).rejects.toThrow(/\/nope\//);
  });

  it("knows only the configured identities", async () => {
    const ledger = await FabricLedger.connect({ port: 8800, channel: "c", chaincode: "c", identities: {} });
    expect([ledger.hasIdentity("AD_BANK"), ledger.hasIdentity("EXPORTERS_BODY")]).toEqual([false, false]);
  });
});
