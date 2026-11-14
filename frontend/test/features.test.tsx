import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { subscribeEvents, type Api } from "../src/api";
import { ImportOutcome, Milestone, type LedgerEvent } from "../src/generated/contracts";
import { ledgerEvent, metricsFixture, timelineFixture } from "./fixtures";

const SB = "a".repeat(64);
const H = "sb_number,port_code,sb_date,customs_status,observed_on";
const ABC_SHA = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

function fakeApi(over: Partial<Api> = {}): Api {
  return {
    createRecord: vi.fn().mockResolvedValue({ sb_hash: SB, tx_id: "t0" }),
    recordMilestone: vi.fn().mockResolvedValue({ sb_hash: SB, tx_id: "t1" }),
    getTimeline: vi.fn().mockResolvedValue(timelineFixture),
    listRecords: vi.fn().mockResolvedValue([timelineFixture]),
    getMetrics: vi.fn().mockResolvedValue(metricsFixture),
    importCustoms: vi.fn(),
    checkReference: vi.fn(),
    subscribeEvents: vi.fn().mockReturnValue(() => {}),
    ...over,
  };
}

const calls = (fn: unknown) => (fn as ReturnType<typeof vi.fn>).mock.calls.length;

describe("customs import view", () => {
  function open(api: Api) {
    render(<App api={api} />);
    fireEvent.click(screen.getByRole("button", { name: "Customs import" }));
  }
  const paste = (t: string) => {
    fireEvent.change(screen.getByLabelText("Or paste CSV text"), { target: { value: t } });
    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
  };

  it("previews, sends and renders the result", async () => {
    const importCustoms = vi.fn().mockResolvedValue({
      total: 2,
      recorded: 1,
      not_found: 1,
      failed: 0,
      rows: [
        { row: 1, sb_hash: SB, outcome: ImportOutcome.RECORDED, tx_id: "t9" },
        { row: 2, sb_hash: "c".repeat(64), outcome: ImportOutcome.NOT_FOUND },
      ],
    });
    open(fakeApi({ importCustoms }));
    expect(screen.getByText("Role: EXPORTERS_BODY")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Download sample CSV" })).toBeInTheDocument();
    paste(`${H}\nA1,INMAA1,2026-10-01,pending,2026-10-02\nA2,INMAA1,2026-10-01,REALISED,2026-10-03`);
    expect(screen.getByRole("table", { name: "Import preview" })).toHaveTextContent("A2");
    fireEvent.click(screen.getByRole("button", { name: "Send 2 rows to the ledger" }));
    await screen.findByText("1 recorded, 1 not found, 0 failed (of 2).");
    expect(importCustoms).toHaveBeenCalledWith({
      rows: [
        { sb_number: "A1", port_code: "INMAA1", sb_date: "2026-10-01", customs_status: "PENDING", observed_on: "2026-10-02" },
        { sb_number: "A2", port_code: "INMAA1", sb_date: "2026-10-01", customs_status: "REALISED", observed_on: "2026-10-03" },
      ],
    });
    const rows = within(screen.getByRole("table", { name: "Import rows" }));
    expect(rows.getByText("NOT_FOUND")).toBeInTheDocument();
    expect(rows.getByText("aaaaaaaaaaaa…")).toBeInTheDocument();
  });

  it("shows per-line errors and does not send", () => {
    const api = fakeApi();
    open(api);
    paste(`${H}\nA1,INMAA1,bad,PENDING,2026-10-02`);
    expect(screen.getByRole("alert")).toHaveTextContent("Line 2: sb_date must be a date");
    expect(screen.queryByRole("button", { name: /Send/ })).not.toBeInTheDocument();
    expect(api.importCustoms).not.toHaveBeenCalled();
  });
});

describe("reference check", () => {
  async function openTimeline(checkReference: Api["checkReference"]) {
    render(<App api={fakeApi({ checkReference })} />);
    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    await screen.findByText("Check a document or reference", { selector: "h3" });
    fireEvent.change(screen.getByLabelText("Milestone to check"), { target: { value: Milestone.DOCS_ACKNOWLEDGED } });
    fireEvent.change(screen.getByLabelText("Raw reference to check"), { target: { value: "D-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Check against the ledger" }));
  }
  const base = { sb_hash: SB, milestone: Milestone.DOCS_ACKNOWLEDGED };

  it("matches", async () => {
    const f = vi.fn().mockResolvedValue({ ...base, recorded: true, matches: true, tx_id: "tx-demo-001-long", ledger_time: "2026-10-20T09:05:00Z" });
    await openTimeline(f);
    expect(await screen.findByTestId("reference-check-result")).toHaveTextContent(
      "Matches the ledger (recorded 2026-10-20T09:05:00Z, tx tx-demo-001-…)",
    );
    expect(f).toHaveBeenCalledWith(SB, { milestone: "DOCS_ACKNOWLEDGED", reference: "D-1" });
  });
  it("does not match", async () => {
    await openTimeline(vi.fn().mockResolvedValue({ ...base, recorded: true, matches: false }));
    expect(await screen.findByTestId("reference-check-result")).toHaveTextContent("Does NOT match the ledger");
  });
  it("not recorded yet", async () => {
    await openTimeline(vi.fn().mockResolvedValue({ ...base, recorded: false, matches: false }));
    expect(await screen.findByTestId("reference-check-result")).toHaveTextContent("No docs acknowledged recorded yet");
  });
  it("fingerprints a chosen file in the browser and says it is not uploaded", async () => {
    await openTimeline(vi.fn().mockResolvedValue({ ...base, recorded: true, matches: true, tx_id: "t", ledger_time: "x" }));
    fireEvent.change(screen.getByLabelText("Or choose a document"), { target: { files: [new File(["abc"], "bill.pdf")] } });
    await screen.findByText(/was not uploaded/);
    expect(screen.getByLabelText("Raw reference to check")).toHaveValue(ABC_SHA);
  });
  it("bank desk fills the reference from a file", async () => {
    render(<App api={fakeApi()} />);
    fireEvent.click(screen.getByRole("button", { name: "PAYMENT RECEIVED" }));
    fireEvent.change(screen.getByLabelText(/fingerprint \(SHA-256\)/), { target: { files: [new File(["abc"], "p.pdf")] } });
    await waitFor(() => expect(screen.getByLabelText(/Reference \(hashed/)).toHaveValue(ABC_SHA));
  });
});

describe("live updates", () => {
  it("shows Live and the latest event, and refreshes once per burst", async () => {
    let push: (e: LedgerEvent) => void = () => {};
    let status: (l: boolean) => void = () => {};
    const unsubscribe = vi.fn();
    const api = fakeApi({
      subscribeEvents: vi.fn((onEvent, onStatus) => {
        push = onEvent;
        status = onStatus!;
        return unsubscribe;
      }),
    });
    const { unmount } = render(<App api={api} />);
    expect(screen.getByText(/Offline/)).toBeInTheDocument();
    act(() => status(true));
    expect(screen.getByText(/^Live/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
    await screen.findByText("DOCS ACKNOWLEDGED");
    const listCalls = calls(api.listRecords);
    act(() => {
      for (let i = 0; i < 5; i++) push(ledgerEvent("3fa9c1" + "0".repeat(58)));
    });
    expect(screen.getByText(/Payment received recorded for 3fa9c1000000…/)).toBeInTheDocument();
    await waitFor(() => expect(calls(api.listRecords)).toBe(listCalls + 1), { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 700));
    expect(calls(api.listRecords)).toBe(listCalls + 1);

    // an event for the open record re-fetches it
    fireEvent.change(screen.getByLabelText("Shipping bill hash"), { target: { value: SB } });
    fireEvent.click(screen.getByRole("button", { name: "Look up" }));
    await screen.findByRole("button", { name: "Show all records" });
    const before = calls(api.getTimeline);
    act(() => push(ledgerEvent(SB)));
    await waitFor(() => expect(calls(api.getTimeline)).toBe(before + 1), { timeout: 3000 });

    fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
    await screen.findByText("Records in demo: 12");
    const m = calls(api.getMetrics);
    act(() => push(ledgerEvent(SB)));
    await waitFor(() => expect(calls(api.getMetrics)).toBe(m + 1), { timeout: 3000 });

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe("subscribeEvents", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a no-op without EventSource", () => {
    vi.stubGlobal("EventSource", undefined);
    const off = subscribeEvents(vi.fn());
    expect(() => off()).not.toThrow();
  });

  it("listens to MilestoneRecorded, ignores malformed data, and closes", () => {
    const listeners: Record<string, (e: { data: string }) => void> = {};
    const close = vi.fn();
    const created: string[] = [];
    const instances: { onopen: (() => void) | null; onerror: (() => void) | null }[] = [];
    class FakeES {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(url: string) {
        created.push(url);
        instances.push(this);
      }
      addEventListener(n: string, fn: (e: { data: string }) => void) {
        listeners[n] = fn;
      }
      close = close;
    }
    vi.stubGlobal("EventSource", FakeES);
    const onEvent = vi.fn();
    const onStatus = vi.fn();
    const off = subscribeEvents(onEvent, onStatus);
    expect(created).toEqual(["/api/events"]);
    listeners["MilestoneRecorded"]({ data: "not json" });
    listeners["MilestoneRecorded"]({ data: "{}" });
    expect(onEvent).not.toHaveBeenCalled();
    const ev = ledgerEvent(SB);
    listeners["MilestoneRecorded"]({ data: JSON.stringify(ev) });
    expect(onEvent).toHaveBeenCalledWith(ev);
    instances[0].onopen!();
    instances[0].onerror!();
    expect(onStatus.mock.calls).toEqual([[true], [false]]);
    off();
    expect(close).toHaveBeenCalled();
  });
});
