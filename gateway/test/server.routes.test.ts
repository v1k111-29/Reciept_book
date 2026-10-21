/** Routing, request validation and payload handling of src/server.ts. OWNER: P3. */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { buildServer } from "../src/server";
import { LedgerError } from "../src/ledger/types";
import { FakeLedger } from "./fakeLedger";

const SB = "b".repeat(64);
let ledger = new FakeLedger();
const servers: Server[] = [];
let base = "";
let bare = ""; // a server built without a ledger

async function start(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  base = await start(
    buildServer({
      hasIdentity: (r) => ledger.hasIdentity(r),
      submit: (f, a, i) => ledger.submit(f, a, i),
      evaluate: (f, a, i) => ledger.evaluate(f, a, i),
    }),
  );
  bare = await start(buildServer());
});
afterAll(() => Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))));
beforeEach(() => {
  ledger = new FakeLedger();
});

async function call(path: string, body: unknown, url = base) {
  const r = await fetch(`${url}${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

describe("routing (CHAINCODE_WRITES, D-20)", () => {
  it("rejects a write on /evaluate", async () => {
    const r = await call("/evaluate", { function: "RecordMilestone", args: ["{}"], identity: "AD_BANK" });
    expect([r.status, r.body.error.code]).toEqual([422, "VALIDATION"]);
    expect(r.body.error.message).toMatch(/\/submit/);
    expect(ledger.calls).toEqual([]);
  });

  it("rejects a read on /submit", async () => {
    const r = await call("/submit", { function: "GetRecord", args: [SB], identity: "AD_BANK" });
    expect([r.status, r.body.error.code]).toEqual([422, "VALIDATION"]);
    expect(r.body.error.message).toMatch(/\/evaluate/);
    expect(ledger.calls).toEqual([]);
  });
});

describe("request validation", () => {
  it.each([
    ["malformed JSON", "{not json"],
    ["a JSON array", "[]"],
    ["an extra field", { function: "GetRecord", args: [SB], identity: "AD_BANK", note: "x" }],
    ["an unknown identity", { function: "GetRecord", args: [SB], identity: "CUSTOMS" }],
    ["a non-string arg", { function: "GetRecord", args: [42], identity: "AD_BANK" }],
    ["too many args", { function: "GetRecord", args: [SB, SB], identity: "AD_BANK" }],
    ["too few args", { function: "GetRecord", identity: "AD_BANK" }],
  ])("rejects %s with VALIDATION", async (_name, body) => {
    const r = await call("/evaluate", body);
    expect(r.status).toBe(422);
    expect(r.body).toMatchObject({ ok: false, tx_id: null, error: { code: "VALIDATION" } });
    expect(ledger.calls).toEqual([]);
  });

  it("defaults a missing args to [] (ListRecords takes none)", async () => {
    const r = await call("/evaluate", { function: "ListRecords", identity: "AD_BANK" });
    expect(r.status).toBe(200);
    expect(ledger.calls[0].args).toEqual([]);
  });

  it("rejects an identity with no configured credentials (D-21)", async () => {
    const r = await call("/evaluate", { function: "ListRecords", args: [], identity: "CUSTOMS_VIEWER" });
    expect([r.status, r.body.error.code]).toEqual([422, "VALIDATION"]);
    expect(r.body.error.message).toMatch(/CUSTOMS_VIEWER/);
  });
});

describe("payload and failures", () => {
  it("returns payload as parsed JSON, never a JSON string", async () => {
    ledger.evaluateImpl = async () => '{"sb_hash":"' + SB + '","events":[]}';
    const r = await call("/evaluate", { function: "GetRecord", args: [SB], identity: "AD_BANK" });
    expect(r.body.payload).toEqual({ sb_hash: SB, events: [] });
  });

  it("returns payload null for an empty response", async () => {
    ledger.evaluateImpl = async () => "";
    const r = await call("/evaluate", { function: "ListRecords", args: [], identity: "AD_BANK" });
    expect([r.status, r.body.payload]).toEqual([200, null]);
  });

  it("answers INTERNAL, with the tx id, when a committed write returns non-JSON", async () => {
    ledger.submitImpl = async () => ({ txId: "tx-9", result: "not json" });
    const r = await call("/submit", { function: "CreateRecord", args: [SB], identity: "AD_BANK" });
    expect([r.status, r.body.error.code, r.body.tx_id]).toEqual([500, "INTERNAL", "tx-9"]);
  });

  it("answers INTERNAL for an error that is not a LedgerError (REQ-p1-21)", async () => {
    ledger.submitImpl = async () => {
      throw new TypeError("boom");
    };
    const r = await call("/submit", { function: "CreateRecord", args: [SB], identity: "AD_BANK" });
    expect([r.status, r.body.error.code]).toEqual([500, "INTERNAL"]);
  });

  it("never returns a tx_id from /evaluate, even on failure (D-21)", async () => {
    ledger.evaluateImpl = async () => {
      throw new LedgerError({ kind: "endorse", txId: "tx-3", messages: ["chaincode response 500, NOT_FOUND: no record"] });
    };
    const r = await call("/evaluate", { function: "GetRecord", args: [SB], identity: "AD_BANK" });
    expect([r.status, r.body.error.code, r.body.tx_id]).toEqual([404, "NOT_FOUND", null]);
  });

  it("treats a commit-stage failure on a read as INTERNAL", async () => {
    ledger.evaluateImpl = async () => {
      throw new LedgerError({ kind: "outcome_unknown", txId: "tx-4" });
    };
    const r = await call("/evaluate", { function: "GetRecord", args: [SB], identity: "AD_BANK" });
    expect([r.status, r.body.error.code, r.body.tx_id]).toEqual([500, "INTERNAL", null]);
  });

  it("answers LEDGER_UNAVAILABLE when the gateway has no ledger", async () => {
    const r = await call("/submit", { function: "CreateRecord", args: [SB], identity: "AD_BANK" }, bare);
    expect([r.status, r.body.error.code]).toEqual([503, "LEDGER_UNAVAILABLE"]);
  });

  it("answers VALIDATION for an unknown route (ISS-p3-4: not NOT_FOUND)", async () => {
    const r = await fetch(`${base}/records`);
    expect(r.status).toBe(422);
    expect((await r.json()).error.code).toBe("VALIDATION");
  });
});
