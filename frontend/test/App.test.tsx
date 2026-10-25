import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { App, causeInWords } from "../src/App";
import { ApiError, type Api } from "../src/api";
import { CauseBucket } from "../src/generated/contracts";
import { metricsFixture, timelineFixture } from "./fixtures";

function fakeApi(over: Partial<Api> = {}): Api {
  return {
    createRecord: vi.fn().mockResolvedValue({ sb_hash: "a".repeat(64), tx_id: "t0" }),
    recordMilestone: vi.fn().mockResolvedValue({ sb_hash: "a".repeat(64), tx_id: "t1" }),
    getTimeline: vi.fn().mockResolvedValue(timelineFixture),
    listRecords: vi.fn().mockResolvedValue([timelineFixture]),
    getMetrics: vi.fn().mockResolvedValue(metricsFixture),
    ...over,
  };
}

test("renders the app title and bank desk by default", () => {
  render(<App api={fakeApi()} />);
  expect(screen.getByRole("heading", { name: "S14 Receipt Book" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Bank desk" })).toBeInTheDocument();
});

test("renders only bank-writable milestones on the bank desk", () => {
  render(<App api={fakeApi()} />);
  expect(screen.getByRole("button", { name: "DOCS ACKNOWLEDGED" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PAYMENT RECEIVED" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EDPMS MARKED OFF" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "EBRC SELF CERTIFIED" })).not.toBeInTheDocument();
});

test("renders exporter-writable milestones on the exporters' desk", () => {
  render(<App api={fakeApi()} />);
  fireEvent.click(screen.getByRole("button", { name: "Exporters' desk" }));
  expect(screen.getByRole("heading", { name: "Exporters' desk" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "EBRC SELF CERTIFIED" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "CUSTOMS STATUS OBSERVED" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "EDPMS MARKED OFF" })).not.toBeInTheDocument();
});

test("bank desk submits a milestone through the api", async () => {
  const api = fakeApi();
  render(<App api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "PAYMENT RECEIVED" }));
  fireEvent.change(screen.getByLabelText("Shipping bill hash"), { target: { value: "a".repeat(64) } });
  fireEvent.change(screen.getByLabelText("Occurred on"), { target: { value: "2026-10-02" } });
  fireEvent.change(screen.getByLabelText(/Reference/), { target: { value: "IRM-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Record milestone" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("t1"));
  expect(api.recordMilestone).toHaveBeenCalledWith("a".repeat(64), {
    milestone: "PAYMENT_RECEIVED",
    occurred_on: "2026-10-02",
    acting_as: "AD_BANK",
    reference: "IRM-1",
    customs_status: undefined,
  });
});

test("a rejected write shows the error code", async () => {
  const api = fakeApi({
    recordMilestone: vi.fn().mockRejectedValue(new ApiError("PRECONDITION_FAILED", "payment first", 409)),
  });
  render(<App api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "DOCS ACKNOWLEDGED" }));
  fireEvent.change(screen.getByLabelText("Shipping bill hash"), { target: { value: "b".repeat(64) } });
  fireEvent.change(screen.getByLabelText("Occurred on"), { target: { value: "2026-10-02" } });
  fireEvent.change(screen.getByLabelText(/Reference/), { target: { value: "D1" } });
  fireEvent.click(screen.getByRole("button", { name: "Record milestone" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("PRECONDITION_FAILED: payment first"));
});

test("timeline lists milestones in ledger order with cause in plain words", async () => {
  render(<App api={fakeApi()} />);
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  expect(await screen.findByText("DOCS ACKNOWLEDGED")).toBeInTheDocument();
  expect(screen.getByText("PAYMENT RECEIVED")).toBeInTheDocument();
  expect(screen.getByText("Exporter linkage missing")).toBeInTheDocument();
  expect(screen.getAllByText(/Signed by: AD_BANK/)).toHaveLength(2);
});

test("every cause bucket has plain words", () => {
  for (const b of Object.values(CauseBucket)) expect(causeInWords(b)).not.toMatch(/_/);
});

test("renders the pilot metrics", async () => {
  render(<App api={fakeApi()} />);
  fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
  expect(await screen.findByText("Records in demo: 12")).toBeInTheDocument();
  expect(screen.getByText("Pending records: 5")).toBeInTheDocument();
});

test("metrics view says not enough data for null measures", async () => {
  const api = fakeApi({
    getMetrics: vi.fn().mockResolvedValue({
      ...metricsFixture,
      median_docs_handover_to_ack_days: null,
      median_payment_to_markoff_days: null,
      pending_with_markoff_share: null,
    }),
  });
  render(<App api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "Metrics" }));
  await waitFor(() => expect(screen.getAllByText(/Not enough data/)).toHaveLength(3));
});

test("timeline lookup rejects a value that is not a hash", async () => {
  const api = fakeApi();
  render(<App api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  fireEvent.change(screen.getByLabelText("Shipping bill hash"), { target: { value: "SB-123" } });
  fireEvent.click(screen.getByRole("button", { name: "Look up" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("64-character");
  expect(api.getTimeline).not.toHaveBeenCalled();
});

test("a record written on a desk opens on the timeline", async () => {
  const api = fakeApi();
  render(<App api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "PAYMENT RECEIVED" }));
  fireEvent.change(screen.getByLabelText("Shipping bill hash"), { target: { value: "a".repeat(64) } });
  fireEvent.change(screen.getByLabelText("Occurred on"), { target: { value: "2026-10-02" } });
  fireEvent.change(screen.getByLabelText(/Reference/), { target: { value: "IRM-1" } });
  fireEvent.click(screen.getByRole("button", { name: "Record milestone" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("t1"));
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  await waitFor(() => expect(api.getTimeline).toHaveBeenCalledWith("a".repeat(64)));
  expect(await screen.findByRole("button", { name: "Show all records" })).toBeInTheDocument();
});

test("an unknown outcome tells the user to check before retrying", async () => {
  const api = fakeApi({
    recordMilestone: vi.fn().mockRejectedValue(new ApiError("OUTCOME_UNKNOWN", "commit status unknown", 504)),
  });
  render(<App api={api} />);
  fireEvent.click(screen.getByRole("button", { name: "EDPMS MARKED OFF" }));
  fireEvent.change(screen.getByLabelText("Shipping bill hash"), { target: { value: "a".repeat(64) } });
  fireEvent.change(screen.getByLabelText("Occurred on"), { target: { value: "2026-10-02" } });
  fireEvent.click(screen.getByRole("button", { name: "Record milestone" }));
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("may have been recorded"));
});

test("timeline orders same-second events by real time, not string order", async () => {
  const [first, second] = timelineFixture.record.events;
  const view = {
    ...timelineFixture,
    record: {
      ...timelineFixture.record,
      events: [
        { ...second, ledger_time: "2026-10-20T09:05:00.500000Z" },
        { ...first, ledger_time: "2026-10-20T09:05:00Z" },
      ],
    },
  };
  render(<App api={fakeApi({ listRecords: vi.fn().mockResolvedValue([view]) })} />);
  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  const items = await screen.findAllByRole("listitem");
  expect(items[0]).toHaveTextContent("DOCS ACKNOWLEDGED");
  expect(items[1]).toHaveTextContent("PAYMENT RECEIVED");
});
