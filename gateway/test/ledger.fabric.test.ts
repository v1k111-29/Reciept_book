/** Fabric error conversion and submit flow of src/ledger/fabric.ts, without a network. OWNER: P3. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { status as grpcStatus, type ServiceError } from "@grpc/grpc-js";
import { CommitStatusError, EndorseError, GatewayError } from "@hyperledger/fabric-gateway";
import {
  evaluateVia,
  FabricLedger,
  isEndorseMismatch,
  MISMATCH_RETRY,
  otherOrgRoles,
  statusName,
  submitVia,
  toLedgerFailure,
} from "../src/ledger/fabric";
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

const signedRequest = new Uint8Array([1, 2, 3]);

describe("submit and evaluate flow", () => {
  const submitted = (code: number, successful = code === 0) => ({
    getResult: () => new TextEncoder().encode('{"ok":1}'),
    getBytes: () => signedRequest,
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
    const fast = { retry: { ...MISMATCH_RETRY, waitMs: 0 } };
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
      await submitVia(s.c, "RecordMilestone", ["{}"], { retry: { ...fast.retry, budgetMs: -1 } }).catch(() => undefined);
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

  describe("wait for the other orgs' peers to commit (ISS-p3-11)", () => {
    afterEach(() => vi.restoreAllMocks());
    const valid = { code: 0, successful: true, transactionId: "tx-1", blockNumber: 7n };
    /** Another org's peer whose getStatus runs `status`; records the bytes and deadline it was given. */
    const peer = (name: string, status: (options: { deadline: number }) => Promise<unknown>) => {
      const seen: { bytes?: Uint8Array; deadline?: number; calls: number } = { calls: 0 };
      const org = {
        name,
        newCommit: (bytes: Uint8Array) => {
          seen.bytes = bytes;
          return {
            getStatus: async (options?: any) => {
              seen.calls++;
              seen.deadline = options?.deadline;
              return status(options) as any;
            },
          };
        },
      };
      return { org, seen };
    };
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    it("asks the other org's peer with the submitter's signed request and returns the result", async () => {
      const org2 = peer("Org2MSP", async () => valid);
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const c = contract({ submitAsync: async () => submitted(0) });
      const before = Date.now();
      await expect(submitVia(c, "CreateRecord", ["a"], { otherOrgs: [org2.org] })).resolves.toEqual({ txId: "tx-1", result: '{"ok":1}' });
      expect([org2.seen.calls, org2.seen.bytes]).toEqual([1, signedRequest]);
      // deadline = attempt start + endorse + submit + commit status
      expect(org2.seen.deadline! - before).toBeGreaterThan(8900);
      expect(org2.seen.deadline! - before).toBeLessThanOrEqual(9000 + (Date.now() - before));
      expect(warn).not.toHaveBeenCalled();
    });

    it("waits for a slow peer that commits within the budget", async () => {
      let committed = false;
      const org2 = peer("Org2MSP", async () => {
        await delay(50);
        committed = true;
        return valid;
      });
      const c = contract({ submitAsync: async () => submitted(0) });
      await submitVia(c, "RecordMilestone", ["{}"], { otherOrgs: [org2.org] });
      expect(committed).toBe(true);
    });

    it("still returns the result, with one warning, when the other peer times out", async () => {
      const org2 = peer("Org2MSP", async () => {
        throw new CommitStatusError({ code: grpcStatus.DEADLINE_EXCEEDED, details: [], cause, transactionId: "tx-1" });
      });
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const c = contract({ submitAsync: async () => submitted(0) });
      await expect(submitVia(c, "RecordMilestone", ["{}"], { otherOrgs: [org2.org] })).resolves.toEqual({ txId: "tx-1", result: '{"ok":1}' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toMatch(/tx tx-1 committed, but not confirmed on Org2MSP/);
    });

    it("still returns the result, with one warning, when the other peer reports another code", async () => {
      const org2 = peer("Org2MSP", async () => ({ ...valid, code: 11, successful: false }));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const c = contract({ submitAsync: async () => submitted(0) });
      await expect(submitVia(c, "RecordMilestone", ["{}"], { otherOrgs: [org2.org] })).resolves.toMatchObject({ txId: "tx-1" });
      expect(warn.mock.calls.map((a) => a[0])).toEqual(["gateway: tx tx-1 is VALID on the submitting org but MVCC_READ_CONFLICT on Org2MSP"]);
    });

    it("does not ask the other peer when the commit is invalid on the submitting org", async () => {
      const org2 = peer("Org2MSP", async () => valid);
      const c = contract({ submitAsync: async () => submitted(11) });
      const err = await submitVia(c, "RecordMilestone", ["{}"], { otherOrgs: [org2.org] }).catch((e) => e);
      expect([err.failure.kind, org2.seen.calls]).toEqual(["commit", 0]);
    });

    it("picks one role per other org, none for a single-org config", () => {
      const org1 = { mspId: "Org1MSP" };
      const org2 = { mspId: "Org2MSP" };
      expect(otherOrgRoles({ AD_BANK: org1, EXPORTERS_BODY: org2 }, "AD_BANK")).toEqual(["EXPORTERS_BODY"]);
      expect(otherOrgRoles({ AD_BANK: org1, EXPORTERS_BODY: org2 }, "EXPORTERS_BODY")).toEqual(["AD_BANK"]);
      expect(otherOrgRoles({ AD_BANK: org1 }, "AD_BANK")).toEqual([]);
      expect(otherOrgRoles({ AD_BANK: org1, EXPORTERS_BODY: org2, CUSTOMS_VIEWER: org2 }, "AD_BANK")).toEqual(["EXPORTERS_BODY"]);
    });

    it("does not wait without other orgs (single-org config)", async () => {
      const c = contract({ submitAsync: async () => ({ ...submitted(0), getBytes: () => expect.unreachable("getBytes") }) });
      await expect(submitVia(c, "CreateRecord", ["a"])).resolves.toMatchObject({ txId: "tx-1" });
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
