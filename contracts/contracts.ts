/**
 * S14 Receipt Book: TypeScript mirror of backend/s14/contracts.py.
 *
 * OWNER: P1 (team lead). Do not edit the copies in <package>/src/generated/: run
 *   bash scripts/sync_ts_contracts.sh
 * after changing this file. Every TS package has a parity test that compares these
 * values with contracts/contracts.schema.json (exported from contracts.py), so a
 * mismatch between Python and TypeScript turns a test red.
 */

export const CONTRACTS_VERSION = "0.3.0";
export const HASH_PATTERN = /^[0-9a-f]{64}$/;

export const OrgRole = {
  AD_BANK: "AD_BANK",
  EXPORTERS_BODY: "EXPORTERS_BODY",
  CUSTOMS_VIEWER: "CUSTOMS_VIEWER",
} as const;
export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole];

export const Milestone = {
  DOCS_ACKNOWLEDGED: "DOCS_ACKNOWLEDGED",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  EBRC_SELF_CERTIFIED: "EBRC_SELF_CERTIFIED",
  EDPMS_MARKED_OFF: "EDPMS_MARKED_OFF",
  CUSTOMS_STATUS_OBSERVED: "CUSTOMS_STATUS_OBSERVED",
} as const;
export type Milestone = (typeof Milestone)[keyof typeof Milestone];

export const CustomsStatus = { REALISED: "REALISED", PENDING: "PENDING" } as const;
export type CustomsStatus = (typeof CustomsStatus)[keyof typeof CustomsStatus];

export const CauseBucket = {
  CONSISTENT: "CONSISTENT",
  NO_PAYMENT_RECORDED: "NO_PAYMENT_RECORDED",
  EXPORTER_LINKAGE_MISSING: "EXPORTER_LINKAGE_MISSING",
  BANK_NOT_MARKED_OFF: "BANK_NOT_MARKED_OFF",
  DOWNSTREAM_SYNC: "DOWNSTREAM_SYNC",
} as const;
export type CauseBucket = (typeof CauseBucket)[keyof typeof CauseBucket];

export const ChaincodeFunction = {
  CREATE_RECORD: "CreateRecord",
  RECORD_MILESTONE: "RecordMilestone",
  GET_RECORD: "GetRecord",
  LIST_RECORDS: "ListRecords",
} as const;
export type ChaincodeFunction = (typeof ChaincodeFunction)[keyof typeof ChaincodeFunction];

export const ErrorCode = {
  VALIDATION: "VALIDATION",
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  WRONG_ROLE: "WRONG_ROLE",
  WRONG_BANK: "WRONG_BANK",
  PRECONDITION_FAILED: "PRECONDITION_FAILED",
  DUPLICATE_MILESTONE: "DUPLICATE_MILESTONE",
  ENDORSEMENT_FAILED: "ENDORSEMENT_FAILED",
  LEDGER_UNAVAILABLE: "LEDGER_UNAVAILABLE",
  INTERNAL: "INTERNAL", // unexpected gateway or chaincode failure (fallback; keep last)
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const WRITER_ROLE: Record<Milestone, OrgRole> = {
  DOCS_ACKNOWLEDGED: "AD_BANK",
  PAYMENT_RECEIVED: "AD_BANK",
  EBRC_SELF_CERTIFIED: "EXPORTERS_BODY",
  EDPMS_MARKED_OFF: "AD_BANK",
  CUSTOMS_STATUS_OBSERVED: "EXPORTERS_BODY",
};

export const PRECONDITIONS: Record<Milestone, readonly Milestone[]> = {
  DOCS_ACKNOWLEDGED: [],
  PAYMENT_RECEIVED: [],
  EBRC_SELF_CERTIFIED: ["PAYMENT_RECEIVED"],
  EDPMS_MARKED_OFF: ["DOCS_ACKNOWLEDGED", "PAYMENT_RECEIVED"],
  CUSTOMS_STATUS_OBSERVED: [],
};

export const REPEATABLE: readonly Milestone[] = ["CUSTOMS_STATUS_OBSERVED"];
export const REFERENCE_REQUIRED: readonly Milestone[] = [
  "DOCS_ACKNOWLEDGED",
  "EBRC_SELF_CERTIFIED",
  "PAYMENT_RECEIVED",
];

export const DEFAULT_MSP_ROLES: Record<string, OrgRole> = {
  Org1MSP: "AD_BANK",
  Org2MSP: "EXPORTERS_BODY",
};

/** Only this role may call CreateRecord (else WRONG_ROLE); missing record -> NOT_FOUND (D-18). */
export const CREATE_RECORD_ROLE: OrgRole = "AD_BANK";

/** Arguments per chaincode function, in order; all strings ("MilestoneSubmission" = that model as JSON). */
export const CHAINCODE_ARGS: Record<ChaincodeFunction, readonly string[]> = {
  CreateRecord: ["sb_hash"],
  RecordMilestone: ["MilestoneSubmission"],
  GetRecord: ["sb_hash"],
  ListRecords: [],
};

/** Result per function; GatewayResult.payload is this shape as parsed JSON, never a JSON string. */
export const CHAINCODE_RESULT: Record<ChaincodeFunction, string> = {
  CreateRecord: "ShippingBillRecord",
  RecordMilestone: "MilestoneEvent",
  GetRecord: "ShippingBillRecord",
  ListRecords: "list[ShippingBillRecord]",
};

/** HTTP status of a failed gateway or backend response; success is 200 (D-18). */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  ALREADY_EXISTS: 409,
  WRONG_ROLE: 403,
  WRONG_BANK: 403,
  PRECONDITION_FAILED: 409,
  DUPLICATE_MILESTONE: 409,
  ENDORSEMENT_FAILED: 502,
  LEDGER_UNAVAILABLE: 503,
  INTERNAL: 500,
};

export const BACKEND_ROUTES = {
  health: "GET /health",
  create_record: "POST /records",
  record_milestone: "POST /records/{sb_hash}/milestones",
  get_timeline: "GET /records/{sb_hash}",
  list_records: "GET /records",
  metrics: "GET /metrics",
} as const;

export const GATEWAY_ROUTES = {
  health: "GET /health",
  submit: "POST /submit",
  evaluate: "POST /evaluate",
} as const;

// ---- model shapes (dates as ISO strings on the wire) ----
// No free-text field on any ledger shape: it could carry a raw SB/IRM/eBRC number (E9, D-17).

export interface MilestoneSubmission {
  sb_hash: string;
  milestone: Milestone;
  occurred_on: string; // YYYY-MM-DD; for DOCS_ACKNOWLEDGED, the documents' hand-over date
  reference_hash?: string | null;
  customs_status?: CustomsStatus | null;
}

export interface MilestoneEvent extends MilestoneSubmission {
  tx_id: string;
  ledger_time: string; // ISO 8601, timezone required; submission time, not proof of the step (U-12)
  submitter_msp: string;
  submitter_role: OrgRole;
}

export interface ShippingBillRecord {
  sb_hash: string;
  bank_msp: string;
  created_ledger_time: string; // ISO 8601, timezone required
  events: MilestoneEvent[];
}

export interface CreateRecordRequest {
  sb_number: string;
  port_code: string;
  sb_date: string;
}

export interface MilestoneRequest {
  milestone: Milestone;
  occurred_on: string;
  acting_as: OrgRole;
  reference?: string | null; // raw; hashed by the backend, never stored
  customs_status?: CustomsStatus | null;
}

export interface TxReceipt {
  sb_hash: string;
  tx_id: string;
}

export interface CauseAssessment {
  bucket: CauseBucket;
  missing: Milestone[];
  explanation: string;
}

export interface TimelineView {
  record: ShippingBillRecord;
  assessment: CauseAssessment;
}

export interface MetricsSummary {
  n_records: number;
  median_docs_handover_to_ack_days: number | null; // ack ledger_time.date() - its occurred_on (U-12)
  median_payment_to_markoff_days: number | null; // mark-off ledger_time.date() - payment occurred_on (U-12)
  pending_total: number;
  pending_with_markoff: number;
  pending_with_markoff_share: number | null;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
}

export interface GatewayRequest {
  function: ChaincodeFunction;
  args: string[];
  identity: OrgRole;
}

export interface GatewayResult {
  ok: boolean;
  tx_id?: string | null;
  payload?: unknown; // parsed JSON of CHAINCODE_RESULT[function], never a JSON string
  error?: ErrorBody | null;
}

/** Field names of each model, checked against the JSON schema by the parity tests. */
export const MODEL_FIELDS: Record<string, readonly string[]> = {
  MilestoneSubmission: ["sb_hash", "milestone", "occurred_on", "reference_hash", "customs_status"],
  MilestoneEvent: [
    "sb_hash", "milestone", "occurred_on", "reference_hash", "customs_status",
    "tx_id", "ledger_time", "submitter_msp", "submitter_role",
  ],
  ShippingBillRecord: ["sb_hash", "bank_msp", "created_ledger_time", "events"],
  CreateRecordRequest: ["sb_number", "port_code", "sb_date"],
  MilestoneRequest: ["milestone", "occurred_on", "acting_as", "reference", "customs_status"],
  TxReceipt: ["sb_hash", "tx_id"],
  CauseAssessment: ["bucket", "missing", "explanation"],
  TimelineView: ["record", "assessment"],
  MetricsSummary: [
    "n_records", "median_docs_handover_to_ack_days", "median_payment_to_markoff_days",
    "pending_total", "pending_with_markoff", "pending_with_markoff_share",
  ],
  ErrorBody: ["code", "message"],
  GatewayRequest: ["function", "args", "identity"],
  GatewayResult: ["ok", "tx_id", "payload", "error"],
};
