/**
 * Pure ledger rules for one shipping-bill record. OWNER: P2.
 *
 * Keep ALL decision logic here (no Fabric imports) so it can be unit-tested without a
 * network. receiptBook.ts only reads/writes state and calls these functions.
 * The rules must match contracts.py: WRITER_ROLE, PRECONDITIONS, REPEATABLE,
 * REFERENCE_REQUIRED, and "only the record's own bank writes bank milestones".
 * Spec: test/rules.spec.test.ts
 */
import {
  CustomsStatus,
  ErrorCode,
  HASH_PATTERN,
  Milestone,
  MilestoneSubmission,
  OrgRole,
  PRECONDITIONS,
  REFERENCE_REQUIRED,
  REPEATABLE,
  ShippingBillRecord,
  WRITER_ROLE,
} from "./generated/contracts";

export class RuleError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(`${code}: ${message}`);
  }
}

/** Fields of MilestoneSubmission. Python forbids any other field (extra="forbid"); so do we (ISS-p2-6). */
const SUBMISSION_FIELDS: ReadonlySet<string> = new Set([
  "sb_hash", "milestone", "occurred_on", "reference_hash", "customs_status",
]);
const MILESTONES: ReadonlySet<string> = new Set(Object.values(Milestone));
const CUSTOMS_STATUSES: ReadonlySet<string> = new Set(Object.values(CustomsStatus));

const invalid = (message: string): RuleError => new RuleError("VALIDATION", message);

const isHash = (v: unknown): v is string => typeof v === "string" && HASH_PATTERN.test(v);

/** A real calendar date written YYYY-MM-DD (what Python's `date` accepts from JSON). */
function isIsoDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/**
 * Throw VALIDATION unless `submission` is a well-formed MilestoneSubmission, the same checks
 * contracts.py's model makes. The chaincode gets it as parsed JSON, so nothing is trusted.
 */
export function validateSubmission(submission: unknown): asserts submission is MilestoneSubmission {
  if (typeof submission !== "object" || submission === null || Array.isArray(submission)) {
    throw invalid("submission must be a JSON object");
  }
  const s = submission as Record<string, unknown>;
  const extra = Object.keys(s).filter((k) => !SUBMISSION_FIELDS.has(k));
  if (extra.length > 0) throw invalid(`unknown field(s): ${extra.join(", ")}`);
  if (!isHash(s.sb_hash)) throw invalid("sb_hash must be 64 lowercase hex characters");
  if (typeof s.milestone !== "string" || !MILESTONES.has(s.milestone)) {
    throw invalid(`unknown milestone: ${String(s.milestone)}`);
  }
  if (!isIsoDate(s.occurred_on)) throw invalid("occurred_on must be a date YYYY-MM-DD");
  if (s.reference_hash != null && !isHash(s.reference_hash)) {
    throw invalid("reference_hash must be 64 lowercase hex characters");
  }
  if (s.customs_status != null && (typeof s.customs_status !== "string" || !CUSTOMS_STATUSES.has(s.customs_status))) {
    throw invalid(`unknown customs_status: ${String(s.customs_status)}`);
  }
  const milestone = s.milestone as Milestone;
  const isCustoms = milestone === Milestone.CUSTOMS_STATUS_OBSERVED;
  if (isCustoms && s.customs_status == null) {
    throw invalid("customs_status is required for CUSTOMS_STATUS_OBSERVED");
  }
  if (!isCustoms && s.customs_status != null) {
    throw invalid("customs_status is only allowed for CUSTOMS_STATUS_OBSERVED");
  }
  if (REFERENCE_REQUIRED.includes(milestone) && s.reference_hash == null) {
    throw invalid(`reference_hash is required for ${milestone}`);
  }
}

/**
 * Throw RuleError if `submission` may not be appended to `record` by `submitterMsp`.
 * Check order (first failure wins): VALIDATION (malformed submission, or an sb_hash that is
 * not this record's), WRONG_ROLE, WRONG_BANK, DUPLICATE_MILESTONE, PRECONDITION_FAILED.
 */
export function checkMilestone(
  record: ShippingBillRecord,
  submission: MilestoneSubmission,
  submitterMsp: string,
  mspRoles: Record<string, OrgRole>,
): void {
  validateSubmission(submission);
  if (submission.sb_hash !== record.sb_hash) {
    throw invalid("submission sb_hash does not match the record");
  }
  const { milestone } = submission;
  const writer = WRITER_ROLE[milestone];

  // An MSP with no role in the mapping may write nothing (ISS-p2-5).
  const role = Object.prototype.hasOwnProperty.call(mspRoles, submitterMsp) ? mspRoles[submitterMsp] : undefined;
  if (role === undefined) {
    throw new RuleError("WRONG_ROLE", `${submitterMsp} has no role on this network`);
  }
  if (role !== writer) {
    throw new RuleError("WRONG_ROLE", `${milestone} is written by ${writer}, not ${role}`);
  }

  // Bank milestones: only the bank that created the record (ISS-p2-7).
  if (writer === OrgRole.AD_BANK && submitterMsp !== record.bank_msp) {
    throw new RuleError("WRONG_BANK", `only ${record.bank_msp} writes bank milestones on this record`);
  }

  const recorded = new Set(record.events.map((e) => e.milestone));
  if (!REPEATABLE.includes(milestone) && recorded.has(milestone)) {
    throw new RuleError("DUPLICATE_MILESTONE", `${milestone} is already recorded`);
  }

  const missing = PRECONDITIONS[milestone].filter((m) => !recorded.has(m));
  if (missing.length > 0) {
    throw new RuleError("PRECONDITION_FAILED", `${milestone} needs ${missing.join(", ")} first`);
  }
}
