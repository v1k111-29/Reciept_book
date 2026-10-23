
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createRecord,
  getMetrics,
  getTimeline,
  listRecords,
  recordMilestone,
} from "../src/api";
import {
  ErrorCode,
  Milestone,
  OrgRole,
  type CreateRecordRequest,
  type MilestoneRequest,
  type TimelineView,
  type TxReceipt,
} from "../src/generated/contracts";
import { metricsFixture, timelineFixture } from "./fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client (P5)", () => {
  it("createRecord POSTs to /api/records and returns sb_hash", async () => {
    const req: CreateRecordRequest = {
      sb_number: "1234567",
      port_code: "INMAA1",
      sb_date: "2026-10-20",
    };
    const receipt: TxReceipt = {
      sb_hash: "a".repeat(64),
      tx_id: "tx-create-001",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(receipt), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRecord(req);

    expect(fetchMock).toHaveBeenCalledWith("/api/records", {
      method: "POST",
      body: JSON.stringify(req),
      headers: { "Content-Type": "application/json" },
    });
    expect(result.sb_hash).toBe(receipt.sb_hash);
    expect(result.tx_id).toBe(receipt.tx_id);
  });

  it("recordMilestone POSTs to /api/records/{sb_hash}/milestones", async () => {
    const sbHash = "a".repeat(64);
    const req: MilestoneRequest = {
      milestone: Milestone.PAYMENT_RECEIVED,
      occurred_on: "2026-10-20",
      acting_as: OrgRole.AD_BANK,
      reference: "payment-ref-001",
    };
    const receipt: TxReceipt = { sb_hash: sbHash, tx_id: "tx-milestone-001" };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(receipt), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await recordMilestone(sbHash, req);

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/records/${sbHash}/milestones`,
      {
        method: "POST",
        body: JSON.stringify(req),
        headers: { "Content-Type": "application/json" },
      },
    );
    expect(result).toEqual(receipt);
  });

  it("getTimeline GETs /api/records/{sb_hash} and returns a TimelineView", async () => {
    const timeline: TimelineView = timelineFixture;
    const sbHash = timeline.record.sb_hash;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(timeline), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getTimeline(sbHash);

    expect(fetchMock).toHaveBeenCalledWith(`/api/records/${sbHash}`, {
      headers: { "Content-Type": "application/json" },
    });
    expect(result.record.sb_hash).toBe(sbHash);
    expect(result.record.events).toHaveLength(2);
    expect(result.assessment.bucket).toBe(timeline.assessment.bucket);
  });

  it("an error body {code, message} is thrown as an Error carrying the ErrorCode", async () => {
    const body = {
      code: ErrorCode.NOT_FOUND,
      message: "Shipping bill not found.",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(body), { status: 404 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(getTimeline("a".repeat(64))).rejects.toMatchObject({
      name: "Error",
      message: body.message,
      code: ErrorCode.NOT_FOUND,
    });
  });

  it("getMetrics GETs /api/metrics (G3)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(metricsFixture), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getMetrics();

    expect(fetchMock).toHaveBeenCalledWith("/api/metrics", {
      headers: { "Content-Type": "application/json" },
    });
    expect(result).toEqual(metricsFixture);
  });
  it("listRecords GETs /api/records and returns timeline records", async () => {
  const records: TimelineView[] = [timelineFixture];
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify(records), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);

  const result = await listRecords();

  expect(fetchMock).toHaveBeenCalledWith("/api/records", {
    headers: { "Content-Type": "application/json" },
  });
  expect(result).toEqual(records);
});

});

describe("views (P5)", () => {
  it("Timeline lists milestones in ledger_time order with submitter role (G2)", () => {
    const events = [...timelineFixture.record.events].reverse();
    const sorted = events.sort(
      (a, b) => Date.parse(a.ledger_time) - Date.parse(b.ledger_time),
    );

    expect(sorted.map((event) => event.milestone)).toEqual([
      Milestone.DOCS_ACKNOWLEDGED,
      Milestone.PAYMENT_RECEIVED,
    ]);
    expect(sorted.map((event) => event.submitter_role)).toEqual([
      OrgRole.AD_BANK,
      OrgRole.AD_BANK,
    ]);
  });

  it.todo("Timeline shows the cause bucket in plain words, e.g. DOWNSTREAM_SYNC (G3)");
  it.todo("Bank desk only offers the milestones WRITER_ROLE allows for AD_BANK (G3)");
  it.todo("Metrics view shows 'not enough data' for null measures (G3)");
});
