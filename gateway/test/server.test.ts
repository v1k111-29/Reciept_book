import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import { buildServer } from "../src/server";
import { CONTRACTS_VERSION } from "../src/generated/contracts";

const server = buildServer();
let base = "";
beforeAll(async () => {
  await new Promise<void>((r) => server.listen(0, r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("gateway server (P3)", () => {
  it("GET /health", async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ status: "ok", contracts_version: CONTRACTS_VERSION });
  });
  it.todo("POST /submit calls ledger.submit with the identity's credentials and returns {ok, tx_id} (G2)");
  it.todo("POST /evaluate returns {ok, payload} without submitting a transaction (G2)");
  it.todo("maps a chaincode error 'WRONG_ROLE: ...' to {ok:false, error:{code:'WRONG_ROLE'}} (G2)");
  it.todo("returns LEDGER_UNAVAILABLE when the peer cannot be reached (G2)");
  it.todo("rejects a body that is not a valid GatewayRequest with VALIDATION (G2)");
});
