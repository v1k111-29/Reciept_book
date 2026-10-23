
import { useState } from "react";
import {
  CONTRACTS_VERSION,
  CustomsStatus,
  Milestone,
  OrgRole,
  WRITER_ROLE,
  type TimelineView,
} from "./generated/contracts";
import { createRecord, getTimeline, listRecords, recordMilestone } from "./api";
import { metricsFixture, timelineFixture } from "../test/fixtures";

type View = "bank" | "exporters" | "timeline" | "metrics";

const bankMilestones = [
  Milestone.DOCS_ACKNOWLEDGED,
  Milestone.PAYMENT_RECEIVED,
  Milestone.EDPMS_MARKED_OFF,
];

const exporterMilestones = [
  Milestone.EBRC_SELF_CERTIFIED,
  Milestone.CUSTOMS_STATUS_OBSERVED,
];

function formatMilestone(value: string) {
  return value.replaceAll("_", " ");
}

export function App() {
  const [view, setView] = useState<View>("bank");
  const [sbNumber, setSbNumber] = useState("");
  const [portCode, setPortCode] = useState("");
  const [sbDate, setSbDate] = useState("");
  const [sbHash, setSbHash] = useState(timelineFixture.record.sb_hash);
  const [occurredOn, setOccurredOn] = useState("");
  const [reference, setReference] = useState("");
  const [customsStatus, setCustomsStatus] = useState(CustomsStatus.PENDING);
  const [timeline, setTimeline] = useState<TimelineView | null>(null);
  const [records, setRecords] = useState<TimelineView[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateRecord(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const receipt = await createRecord({
        sb_number: sbNumber,
        port_code: portCode,
        sb_date: sbDate,
      });
      setSbHash(receipt.sb_hash);
      setMessage(`Record created. Transaction: ${receipt.tx_id}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create record.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecordMilestone(milestone: Milestone) {
    if (!occurredOn) {
      setMessage("Choose the date the milestone occurred.");
      return;
    }
if (
  (milestone === Milestone.DOCS_ACKNOWLEDGED ||
    milestone === Milestone.PAYMENT_RECEIVED) &&
  !reference.trim()
) {
      setMessage("Enter a reference for this milestone.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const req = {
        milestone,
        occurred_on: occurredOn,
        acting_as: OrgRole.AD_BANK,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        ...(milestone === Milestone.CUSTOMS_STATUS_OBSERVED
          ? { customs_status: customsStatus }
          : {}),
      };
      const receipt = await recordMilestone(sbHash, req);
      setMessage(`Milestone recorded. Transaction: ${receipt.tx_id}`);
      const result = await getTimeline(receipt.sb_hash);
      setTimeline(result);
      setView("timeline");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not record milestone.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadTimeline(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const result = await getTimeline(sbHash.trim());
      setTimeline(result);
      setMessage("Timeline loaded from the API.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load timeline.");
    } finally {
      setLoading(false);
    }
  }

  const activeTimeline = timeline ?? timelineFixture;
  const sortedEvents = [...activeTimeline.record.events].sort(
    (a, b) => Date.parse(a.ledger_time) - Date.parse(b.ledger_time),
  );
async function handleLoadRecords() {
  setLoading(true);
  setMessage("");

  try {
    const result = await listRecords();
    setRecords(result);
    setMessage(`Loaded ${result.length} records from the API.`);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "Could not load records.");
  } finally {
    setLoading(false);
  }
}
  return (
    <main>
      <header>
        <h1>S14 Receipt Book</h1>
        <p>
          Shared milestone record per shipping bill (pilot). Contracts v
          {CONTRACTS_VERSION}.
        </p>
        <p>Synthetic demo data is shown until you load a record from the API.</p>
      </header>

      <nav aria-label="Main views">
        <button onClick={() => setView("bank")}>Bank desk</button>
        <button onClick={() => setView("exporters")}>Exporters' desk</button>
        <button onClick={() => setView("timeline")}>Timeline</button>
        <button onClick={() => setView("metrics")}>Metrics</button>
      </nav>

      {message && <p role="status">{message}</p>}

      {view === "bank" && (
        <section aria-labelledby="bank-heading">
          <h2 id="bank-heading">Bank desk</h2>
          <p>Role: {OrgRole.AD_BANK}</p>

          <h3>Create shipping bill record</h3>
          <form onSubmit={handleCreateRecord}>
            <label>
              Shipping bill number
              <input value={sbNumber} onChange={(e) => setSbNumber(e.target.value)} required />
            </label>
            <label>
              Port code
              <input value={portCode} onChange={(e) => setPortCode(e.target.value)} required />
            </label>
            <label>
              Shipping bill date
              <input type="date" value={sbDate} onChange={(e) => setSbDate(e.target.value)} required />
            </label>
            <button type="submit" disabled={loading}>Create record</button>
          </form>

          <h3>Record a milestone</h3>
          <button type="button" disabled={loading} onClick={handleLoadRecords}>
            Load existing records
          </button>

          {records.length > 0 && (
            <label>
              Select shipping bill
              <select
                value={sbHash}
                onChange={(e) => setSbHash(e.target.value)}
              >
                {records.map((record) => (
                  <option key={record.record.sb_hash} value={record.record.sb_hash}>
                    {record.record.sb_hash.slice(0, 12)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <p>Current shipping bill hash: {sbHash}</p>
          <label>
            Shipping bill hash
            <input value={sbHash} onChange={(e) => setSbHash(e.target.value)} required />
          </label>
          <label>
            Date milestone occurred
            <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} required />
          </label>
          <label>
            Reference (required for document acknowledgement and payment)
            <input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label>
            Customs status
            <select value={customsStatus} onChange={(e) => setCustomsStatus(e.target.value as typeof customsStatus)}>
              <option value={CustomsStatus.PENDING}>Pending</option>
              <option value={CustomsStatus.REALISED}>Realised</option>
            </select>
          </label>
          <p>Select a milestone to record for a shipping bill.</p>
          <ul>
            {bankMilestones
              .filter((milestone) => WRITER_ROLE[milestone] === OrgRole.AD_BANK)
              .map((milestone) => (
                <li key={milestone}>
                  <button type="button" disabled={loading} onClick={() => handleRecordMilestone(milestone)}>
                    {formatMilestone(milestone)}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {view === "exporters" && (
        <section aria-labelledby="exporters-heading">
          <h2 id="exporters-heading">Exporters' desk</h2>
          <p>Role: {OrgRole.EXPORTERS_BODY}</p>
          <p>Select a milestone to record for a shipping bill.</p>
          <ul>
            {exporterMilestones
              .filter((milestone) => WRITER_ROLE[milestone] === OrgRole.EXPORTERS_BODY)
              .map((milestone) => (
                <li key={milestone}>
                  <button type="button" disabled>
                    {formatMilestone(milestone)}
                  </button>
                </li>
              ))}
          </ul>
          <p>Exporter milestone submission is not connected in this G2 bank workflow.</p>
        </section>
      )}

      {view === "timeline" && (
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading">Shipping bill timeline</h2>
          <form onSubmit={handleLoadTimeline}>
            <label>
              Shipping bill hash
              <input value={sbHash} onChange={(e) => setSbHash(e.target.value)} required />
            </label>
            <button type="submit" disabled={loading}>Load timeline from API</button>
          </form>
          <p>Shipping bill: {activeTimeline.record.sb_hash.slice(0, 12)}…</p>
          <ol>
            {sortedEvents.map((event) => (
              <li key={event.tx_id}>
                <strong>{formatMilestone(event.milestone)}</strong>
                <p>Occurred on: {event.occurred_on}</p>
                <p>Recorded on ledger: {event.ledger_time}</p>
                <p>Signed by: {event.submitter_role}</p>
              </li>
            ))}
          </ol>
          <h3>Cause assessment</h3>
          <p>{formatMilestone(activeTimeline.assessment.bucket)}</p>
          <p>{activeTimeline.assessment.explanation}</p>
        </section>
      )}

      {view === "metrics" && (
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading">Pilot metrics</h2>
          <p>Records in demo: {metricsFixture.n_records}</p>
          <p>
            Median document hand-over to acknowledgement:{" "}
            {metricsFixture.median_docs_handover_to_ack_days ?? "Not enough data"} days
          </p>
          <p>
            Median payment to mark-off:{" "}
            {metricsFixture.median_payment_to_markoff_days ?? "Not enough data"} days
          </p>
          <p>Pending records: {metricsFixture.pending_total}</p>
          <p>Pending records already marked off: {metricsFixture.pending_with_markoff}</p>
          <p>
            Share of pending already marked off:{" "}
            {metricsFixture.pending_with_markoff_share === null
              ? "Not enough data"
              : `${metricsFixture.pending_with_markoff_share * 100}%`}
          </p>
        </section>
      )}
    </main>
  );
}
