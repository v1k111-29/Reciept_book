import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { buildServer } from "../src/server";
import { CONTRACTS_VERSION } from "../src/generated/contracts";
import { LedgerError } from "../src/ledger/types";
import { FakeLedger } from "./fakeLedger";

const SB = "a".repeat(64);
let ledger = new FakeLedger();
const server = buildServer({
  hasIdentity: (r) => ledger.hasIdentity(r),
  submit: (f, a, i) => ledger.submit(f, a, i),
  evaluate: (f, a, i) => ledger.evaluate(f, a, i),
});
let base = "";
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => {
  ledger = new FakeLedger();
});

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

describe("gateway server (P3)", () => {
  it("GET /health", async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok", contracts_version: CONTRACTS_VERSION });
  });

  it("POST /submit calls ledger.submit with the identity's credentials and returns {ok, tx_id} (G2)", async () => {
    ledger.submitImpl = async () => ({ txId: "tx-42", result: JSON.stringify({ sb_hash: SB }) });
    const r = await post("/submit", { function: "CreateRecord", args: [SB], identity: "AD_BANK" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, tx_id: "tx-42", payload: { sb_hash: SB }, error: null });
    expect(ledger.calls).toEqual([{ kind: "submit", fn: "CreateRecord", args: [SB], identity: "AD_BANK" }]);
  });

  it("POST /evaluate returns {ok, payload} without submitting a transaction (G2)", async () => {
    ledger.evaluateImpl = async () => JSON.stringify([{ sb_hash: SB }]);
    const r = await post("/evaluate", { function: "ListRecords", args: [], identity: "EXPORTERS_BODY" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, tx_id: null, payload: [{ sb_hash: SB }], error: null });
    expect(ledger.calls.map((c) => c.kind)).toEqual(["evaluate"]);
  });

  it("maps a chaincode error 'WRONG_ROLE: ...' to {ok:false, error:{code:'WRONG_ROLE'}} (G2)", async () => {
    ledger.submitImpl = async () => {
      throw new LedgerError({
        kind: "endorse",
        txId: "tx-7",
        messages: ["chaincode response 500, WRONG_ROLE: only AD_BANK may create a record"],
      });
    };
    const r = await post("/submit", { function: "CreateRecord", args: [SB], identity: "EXPORTERS_BODY" });
    expect(r.status).toBe(403);
    expect(await r.json()).toEqual({
      ok: false,
      tx_id: "tx-7",
      error: { code: "WRONG_ROLE", message: "WRONG_ROLE: only AD_BANK may create a record" },
    });
  });

  it("returns LEDGER_UNAVAILABLE when the peer cannot be reached (G2)", async () => {
    ledger.evaluateImpl = async () => {
      throw new LedgerError({ kind: "unavailable", message: "14 UNAVAILABLE: connect ECONNREFUSED 127.0.0.1:7051" });
    };
    const r = await post("/evaluate", { function: "GetRecord", args: [SB], identity: "AD_BANK" });
    expect(r.status).toBe(503);
    expect((await r.json()).error.code).toBe("LEDGER_UNAVAILABLE");
  });

  it("rejects a body that is not a valid GatewayRequest with VALIDATION (G2)", async () => {
    const r = await post("/submit", { function: "DeleteEverything", args: [], identity: "AD_BANK" });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ ok: false, tx_id: null, error: { code: "VALIDATION" } });
    expect(ledger.calls).toEqual([]);
  });
});
