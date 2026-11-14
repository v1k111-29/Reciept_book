import { afterEach, describe, expect, it, vi } from "vitest";
import { checkReference, importCustoms } from "../src/api";
import { Milestone } from "../src/generated/contracts";

const SB = "a".repeat(64);

function reply(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("api client 1.1.0 routes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("importCustoms POSTs rows to /api/customs/import", async () => {
    const result = { total: 1, recorded: 1, not_found: 0, failed: 0, rows: [{ row: 1, sb_hash: SB, outcome: "RECORDED", tx_id: "t" }] };
    const f = reply(200, result);
    vi.stubGlobal("fetch", f);
    const req = {
      rows: [{ sb_number: "1", port_code: "P", sb_date: "2026-10-01", customs_status: "PENDING" as const, observed_on: "2026-10-02" }],
    };
    expect(await importCustoms(req)).toEqual(result);
    expect(f.mock.calls[0][0]).toBe("/api/customs/import");
    expect(f.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual(req);
  });

  it("checkReference POSTs to /api/records/{sb_hash}/reference-check", async () => {
    const result = { sb_hash: SB, milestone: "PAYMENT_RECEIVED", recorded: true, matches: true };
    const f = reply(200, result);
    vi.stubGlobal("fetch", f);
    const req = { milestone: Milestone.PAYMENT_RECEIVED, reference: "IRM-1" };
    expect(await checkReference(SB, req)).toEqual(result);
    expect(f.mock.calls[0][0]).toBe(`/api/records/${SB}/reference-check`);
    expect(f.mock.calls[0][1].method).toBe("POST");
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual(req);
  });

  it("surface ErrorBody failures", async () => {
    vi.stubGlobal("fetch", reply(400, { code: "INTERNAL", message: "bad rows" }));
    await expect(importCustoms({ rows: [] })).rejects.toMatchObject({ code: "INTERNAL", status: 400, message: "bad rows" });
    vi.stubGlobal("fetch", reply(404, { code: "NOT_FOUND", message: "no record" }));
    await expect(checkReference(SB, { milestone: Milestone.PAYMENT_RECEIVED, reference: "x" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
