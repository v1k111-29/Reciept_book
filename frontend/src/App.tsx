
import { useState } from "react";
import {
  CONTRACTS_VERSION,
  Milestone,
  OrgRole,
  WRITER_ROLE,
} from "./generated/contracts";
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

  return (
    <main>
      <header>
        <h1>S14 Receipt Book</h1>
        <p>
          Shared milestone record per shipping bill (pilot). Contracts v
          {CONTRACTS_VERSION}.
        </p>
      </header>

      <nav aria-label="Main views">
        <button onClick={() => setView("bank")}>Bank desk</button>
        <button onClick={() => setView("exporters")}>Exporters' desk</button>
        <button onClick={() => setView("timeline")}>Timeline</button>
        <button onClick={() => setView("metrics")}>Metrics</button>
      </nav>

      {view === "bank" && (
        <section aria-labelledby="bank-heading">
          <h2 id="bank-heading">Bank desk</h2>
          <p>Role: {OrgRole.AD_BANK}</p>
          <p>Select a milestone to record for a shipping bill.</p>
          <ul>
            {bankMilestones
              .filter((milestone) => WRITER_ROLE[milestone] === OrgRole.AD_BANK)
              .map((milestone) => (
                <li key={milestone}>
                  <button type="button">{formatMilestone(milestone)}</button>
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
              .filter(
                (milestone) =>
                  WRITER_ROLE[milestone] === OrgRole.EXPORTERS_BODY,
              )
              .map((milestone) => (
                <li key={milestone}>
                  <button type="button">{formatMilestone(milestone)}</button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {view === "timeline" && (
        <section aria-labelledby="timeline-heading">
          <h2 id="timeline-heading">Shipping bill timeline</h2>
          <p>Demo shipping bill: {timelineFixture.record.sb_hash.slice(0, 12)}…</p>
          <ol>
            {timelineFixture.record.events.map((event) => (
              <li key={event.tx_id}>
                <strong>{formatMilestone(event.milestone)}</strong>
                <p>Occurred on: {event.occurred_on}</p>
                <p>Recorded on ledger: {event.ledger_time}</p>
                <p>Signed by: {event.submitter_role}</p>
              </li>
            ))}
          </ol>
          <h3>Cause assessment</h3>
          <p>{formatMilestone(timelineFixture.assessment.bucket)}</p>
          <p>{timelineFixture.assessment.explanation}</p>
        </section>
      )}

      {view === "metrics" && (
        <section aria-labelledby="metrics-heading">
          <h2 id="metrics-heading">Pilot metrics</h2>
          <p>Records in demo: {metricsFixture.n_records}</p>
          <p>
            Median document hand-over to acknowledgement:{" "}
            {metricsFixture.median_docs_handover_to_ack_days} days
          </p>
          <p>
            Median payment to mark-off:{" "}
            {metricsFixture.median_payment_to_markoff_days} days
          </p>
          <p>Pending records: {metricsFixture.pending_total}</p>
          <p>
            Pending records already marked off:{" "}
            {metricsFixture.pending_with_markoff}
          </p>
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
