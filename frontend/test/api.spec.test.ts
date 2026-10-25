import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, createRecord, getMetrics, getTimeline, recordMilestone } from "../src/api";
import { Milestone, OrgRole } from "../src/generated/contracts";
import { metricsFixture, timelineFixture } from "./fixtures";

const SB = "a".repeat(64);

function reply(status: number, body: unknown) {
  return vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
  );
}

describe("api client (P5)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("createRecord POSTs to /api/records and returns sb_hash (G2)", async () => {
    const f = reply(200, { sb_hash: SB, tx_id: "t1" });
    vi.stubGlobal("fetch", f);
    const req = { sb_number: "1234567", port_code: "INMAA1", sb_date: "2026-10-01" };
    expect(await createRecord(req)).toEqual({ sb_hash: SB, tx_id: "t1" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("/api/records");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(req);
  });

  it("recordMilestone POSTs to /api/records/{sb_hash}/milestones (G2)", async () => {
    const f = reply(200, { sb_hash: SB, tx_id: "t2" });
    vi.stubGlobal("fetch", f);
    const req = { milestone: Milestone.PAYMENT_RECEIVED, occurred_on: "2026-10-02", acting_as: OrgRole.AD_BANK };
    await recordMilestone(SB, req);
    expect(f.mock.calls[0][0]).toBe(`/api/records/${SB}/milestones`);
    expect(f.mock.calls[0][1].method).toBe("POST");
  });

  it("getTimeline GETs /api/records/{sb_hash} and returns a TimelineView (G2)", async () => {
    const f = reply(200, timelineFixture);
    vi.stubGlobal("fetch", f);
    expect(await getTimeline(SB)).toEqual(timelineFixture);
    expect(f.mock.calls[0][0]).toBe(`/api/records/${SB}`);
    expect(f.mock.calls[0][1].method).toBe("GET");
  });

  it("an error body {code, message} is thrown as an Error carrying the ErrorCode (G2)", async () => {
    vi.stubGlobal("fetch", reply(403, { code: "WRONG_ROLE", message: "bank only" }));
    const err = await recordMilestone(SB, {
      milestone: Milestone.EBRC_SELF_CERTIFIED,
      occurred_on: "2026-10-02",
      acting_as: OrgRole.AD_BANK,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("WRONG_ROLE");
    expect(err.message).toBe("bank only");
  });

  it("getMetrics GETs /api/metrics (G3)", async () => {
    const f = reply(200, metricsFixture);
    vi.stubGlobal("fetch", f);
    expect(await getMetrics()).toEqual(metricsFixture);
    expect(f.mock.calls[0][0]).toBe("/api/metrics");
  });
});
