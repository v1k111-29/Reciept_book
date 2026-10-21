
import {
  CauseBucket,
  Milestone,
  OrgRole,
  type MetricsSummary,
  type TimelineView,
} from "../src/generated/contracts";

export const timelineFixture: TimelineView = {
  record: {
    sb_hash: "a".repeat(64),
    bank_msp: "Org1MSP",
    created_ledger_time: "2026-10-20T09:00:00Z",
    events: [
      {
        sb_hash: "a".repeat(64),
        milestone: Milestone.DOCS_ACKNOWLEDGED,
        occurred_on: "2026-10-18",
        reference_hash: "b".repeat(64),
        customs_status: null,
        tx_id: "tx-demo-001",
        ledger_time: "2026-10-20T09:05:00Z",
        submitter_msp: "Org1MSP",
        submitter_role: OrgRole.AD_BANK,
      },
      {
        sb_hash: "a".repeat(64),
        milestone: Milestone.PAYMENT_RECEIVED,
        occurred_on: "2026-10-19",
        reference_hash: null,
        customs_status: null,
        tx_id: "tx-demo-002",
        ledger_time: "2026-10-20T09:10:00Z",
        submitter_msp: "Org1MSP",
        submitter_role: OrgRole.AD_BANK,
      },
    ],
  },
  assessment: {
    bucket: CauseBucket.EXPORTER_LINKAGE_MISSING,
    missing: [Milestone.EBRC_SELF_CERTIFIED],
    explanation: "The exporter certification has not yet been recorded.",
  },
};

export const metricsFixture: MetricsSummary = {
  n_records: 12,
  median_docs_handover_to_ack_days: 2,
  median_payment_to_markoff_days: 4,
  pending_total: 5,
  pending_with_markoff: 2,
  pending_with_markoff_share: 0.4,
};
