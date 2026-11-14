/** GET /events (N4): SSE stream of committed MilestoneRecorded events. OWNER: P3. No network. */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { buildServer, KEEP_ALIVE_MS } from "../src/server";
import { MILESTONE_RECORDED_EVENT, MODEL_FIELDS, type LedgerEvent } from "../src/generated/contracts";
import type { Ledger } from "../src/ledger/types";
import { FakeLedger } from "./fakeLedger";

const SB = "c".repeat(64);
const MILESTONE = {
  sb_hash: SB,
  milestone: "PAYMENT_RECEIVED",
  occurred_on: "2026-11-01",
  reference_hash: "d".repeat(64),
  customs_status: null,
  tx_id: "tx-9",
  ledger_time: "2026-11-14T10:00:00Z",
  submitter_msp: "Org1MSP",
  submitter_role: "AD_BANK",
};
const bytes = (s: string) => new TextEncoder().encode(s);
const chaincodeEvent = (over: Partial<{ eventName: string; payload: Uint8Array; blockNumber: bigint }> = {}) => ({
  blockNumber: 12n,
  transactionId: "tx-9",
  eventName: MILESTONE_RECORDED_EVENT,
  payload: bytes(JSON.stringify(MILESTONE)),
  ...over,
});

let ledger = new FakeLedger();
const servers: Server[] = [];
let base = ""; // ledger with an event source, keep-alive every 50 ms
let noEvents = ""; // ledger without events()
let bare = ""; // no ledger at all

async function start(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>((r) => server.listen(0, r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeAll(async () => {
  const delegating: Ledger = {
    hasIdentity: (r) => ledger.hasIdentity(r),
    submit: (f, a, i) => ledger.submit(f, a, i),
    evaluate: (f, a, i) => ledger.evaluate(f, a, i),
    events: (i) => ledger.events(i),
  };
  base = await start(buildServer(delegating, { keepAliveMs: 50 }));
  noEvents = await start(
    buildServer({
      hasIdentity: (r) => ledger.hasIdentity(r),
      submit: (f, a, i) => ledger.submit(f, a, i),
      evaluate: (f, a, i) => ledger.evaluate(f, a, i),
    }),
  );
  bare = await start(buildServer());
});
// Open event streams must not keep close() waiting.
afterAll(() => Promise.all(servers.map((s) => new Promise<void>((r) => s.close(() => r())))));
beforeEach(() => {
  ledger = new FakeLedger();
});

/** Opens GET /events and reads its text as it arrives. */
async function open(url = base) {
  const abort = new AbortController();
  const r = await fetch(`${url}/events`, { signal: abort.signal });
  const reader = r.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const until = async (done: (t: string) => boolean, ms = 2000) => {
    const stop = Date.now() + ms;
    while (!done(text)) {
      if (Date.now() > stop) throw new Error(`timed out; got ${JSON.stringify(text)}`);
      const { value, done: ended } = await reader.read();
      if (ended) break;
      text += decoder.decode(value, { stream: true });
    }
    return text;
  };
  const ended = async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return text;
      text += decoder.decode(value, { stream: true });
    }
  };
  return { r, until, ended, close: () => abort.abort(), text: () => text };
}

/** The `data:` of every `event: MilestoneRecorded` message in an SSE text. */
function messages(text: string): LedgerEvent[] {
  return text
    .split("\n\n")
    .filter((block) => block.startsWith(`event: ${MILESTONE_RECORDED_EVENT}\n`))
    .map((block) => {
      const lines = block.split("\n");
      expect(lines).toHaveLength(2);
      expect(lines[1]).toMatch(/^data: /);
      return JSON.parse(lines[1].slice("data: ".length)) as LedgerEvent;
    });
}

const waitFor = async (cond: () => boolean, ms = 2000) => {
  const stop = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > stop) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 5));
  }
};

describe("GET /events (N4)", () => {
  it("default keep-alive interval is about 15 s", () => {
    expect(KEEP_ALIVE_MS).toBe(15_000);
  });

  it("answers 200 text/event-stream, uncached, and sends a keep-alive comment on connect", async () => {
    const s = await open();
    expect(s.r.status).toBe(200);
    expect(s.r.headers.get("content-type")).toMatch(/^text\/event-stream/);
    expect(s.r.headers.get("cache-control")).toMatch(/no-cache/);
    expect(await s.until((t) => t.length > 0)).toMatch(/^: keep-alive\n\n/);
    s.close();
  });

  it("subscribes as AD_BANK when configured, else the first configured role", async () => {
    const a = await open();
    await waitFor(() => ledger.subscriptions.length === 1);
    expect(ledger.subscriptions[0].identity).toBe("AD_BANK");
    a.close();
    ledger.identities = new Set(["EXPORTERS_BODY"]);
    const b = await open();
    await waitFor(() => ledger.subscriptions.length === 2);
    expect(ledger.subscriptions[1].identity).toBe("EXPORTERS_BODY");
    b.close();
  });

  it("repeats the keep-alive on the injected interval", async () => {
    const s = await open();
    const text = await s.until((t) => t.split(": keep-alive\n\n").length - 1 >= 3);
    expect(text.startsWith(": keep-alive\n\n: keep-alive\n\n")).toBe(true);
    s.close();
  });

  it("writes a pushed MilestoneRecorded event as one SSE message whose data is a LedgerEvent", async () => {
    const s = await open();
    await waitFor(() => ledger.subscriptions.length === 1);
    ledger.subscriptions[0].push(chaincodeEvent());
    const text = await s.until((t) => t.includes("event: "));
    expect(text).toMatch(/event: MilestoneRecorded\ndata: [^\n]+\n\n/);
    const [ev] = messages(text);
    expect(ev).toEqual({ name: "MilestoneRecorded", block_number: 12, tx_id: "tx-9", event: MILESTONE });
    expect(typeof ev.block_number).toBe("number");
    expect(Object.keys(ev).sort()).toEqual([...MODEL_FIELDS.LedgerEvent].sort());
    s.close();
  });

  it("skips events with another name or an unparsable payload, and keeps streaming", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = await open();
    await waitFor(() => ledger.subscriptions.length === 1);
    const sub = ledger.subscriptions[0];
    sub.push(chaincodeEvent({ eventName: "SomethingElse", blockNumber: 1n }));
    sub.push(chaincodeEvent({ payload: bytes("{not json"), blockNumber: 2n }));
    sub.push(chaincodeEvent({ payload: bytes("[1,2]"), blockNumber: 3n }));
    sub.push(chaincodeEvent({ blockNumber: 4n }));
    const text = await s.until((t) => t.includes("event: "));
    expect(messages(text).map((e) => e.block_number)).toEqual([4]);
    expect(text).not.toContain("SomethingElse");
    expect(log).toHaveBeenCalledTimes(3);
    log.mockRestore();
    s.close();
  });

  it("closes the ledger subscription and stops when the client disconnects", async () => {
    const s = await open();
    await waitFor(() => ledger.subscriptions.length === 1);
    expect(ledger.subscriptions[0].closed).toBe(false);
    s.close();
    await waitFor(() => ledger.subscriptions[0].closed);
  });

  it("ends the response when the ledger event stream fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const s = await open();
    await waitFor(() => ledger.subscriptions.length === 1);
    ledger.subscriptions[0].fail(new Error("peer went away"));
    await s.ended();
    expect(ledger.subscriptions[0].closed).toBe(true);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/peer went away/));
    log.mockRestore();
  });

  it("answers 503 LEDGER_UNAVAILABLE when the ledger has no event source", async () => {
    const r = await fetch(`${noEvents}/events`);
    expect(r.status).toBe(503);
    expect(r.headers.get("content-type")).toBe("application/json");
    expect(await r.json()).toMatchObject({ ok: false, tx_id: null, error: { code: "LEDGER_UNAVAILABLE" } });
  });

  it("answers 503 LEDGER_UNAVAILABLE with no ledger configured", async () => {
    const r = await fetch(`${bare}/events`);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ ok: false, error: { code: "LEDGER_UNAVAILABLE" } });
  });

  it("answers 503 LEDGER_UNAVAILABLE when subscribing throws", async () => {
    ledger.events = () => {
      throw new Error("no connection");
    };
    const r = await fetch(`${base}/events`);
    expect(r.status).toBe(503);
    const body = await r.json();
    expect(body.error).toMatchObject({ code: "LEDGER_UNAVAILABLE" });
    expect(body.error.message).toMatch(/no connection/);
  });

  it("handles a wrong method like any unknown route (VALIDATION)", async () => {
    const r = await fetch(`${base}/events`, { method: "POST", body: "{}" });
    expect(r.status).toBe(422);
    expect(await r.json()).toMatchObject({ ok: false, error: { code: "VALIDATION" } });
    expect(ledger.subscriptions).toEqual([]);
  });

  it("server.close() does not hang on an open event stream", async () => {
    const server = buildServer(ledger, { keepAliveMs: 50 });
    const url = await new Promise<string>((r) =>
      server.listen(0, () => r(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)),
    );
    const s = await open(url);
    await s.until((t) => t.length > 0);
    await new Promise<void>((r) => server.close(() => r()));
    expect(ledger.subscriptions[0].closed).toBe(true);
    await s.ended().catch(() => undefined);
  });
});
