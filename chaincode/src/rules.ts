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

/**
 * Throw RuleError if `submission` may not be appended to `record` by `submitterMsp`.
 * Check order (first failure wins): VALIDATION (sb_hash mismatch / bad hash / customs
 * field rules), WRONG_ROLE, WRONG_BANK, DUPLICATE_MILESTONE, PRECONDITION_FAILED.
 */
export function checkMilestone(
  record: ShippingBillRecord,
  submission: MilestoneSubmission,
  submitterMsp: string,
  mspRoles: Record<string, OrgRole>,
): void {
  validate(record, submission);

  const m = submission.milestone;
  const role = mspRoles[submitterMsp];
  if (role !== WRITER_ROLE[m]) {
    throw new RuleError(
      ErrorCode.WRONG_ROLE,
      `${m} is written by ${WRITER_ROLE[m]}; ${submitterMsp} is ${role ?? "not a known MSP"}`,
    );
  }
  if (role === OrgRole.AD_BANK && submitterMsp !== record.bank_msp) {
    throw new RuleError(ErrorCode.WRONG_BANK, `only ${record.bank_msp} writes bank milestones on this record`);
  }

  const done = new Set(record.events.map((e) => e.milestone));
  if (!REPEATABLE.includes(m) && done.has(m)) {
    throw new RuleError(ErrorCode.DUPLICATE_MILESTONE, `${m} is already recorded`);
  }
  const missing = PRECONDITIONS[m].filter((p) => !done.has(p));
  if (missing.length > 0) {
    throw new RuleError(ErrorCode.PRECONDITION_FAILED, `${m} needs ${missing.join(", ")} first`);
  }
}

const OCCURRED_ON = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Field checks, the same as MilestoneSubmission's validators in contracts.py. */
function validate(record: ShippingBillRecord, s: MilestoneSubmission): void {
  const fail = (message: string): never => {
    throw new RuleError(ErrorCode.VALIDATION, message);
  };
  if (typeof s.sb_hash !== "string" || !HASH_PATTERN.test(s.sb_hash)) fail("sb_hash is not a valid hash");
  if (s.sb_hash !== record.sb_hash) fail("sb_hash does not match the record");
  if (!Object.prototype.hasOwnProperty.call(WRITER_ROLE, s.milestone)) fail(`unknown milestone ${String(s.milestone)}`);
  if (!isCalendarDate(s.occurred_on)) fail("occurred_on must be a date YYYY-MM-DD");

  const ref = s.reference_hash ?? null;
  if (ref !== null && (typeof ref !== "string" || !HASH_PATTERN.test(ref))) fail("reference_hash is not a valid hash");
  if (ref === null && REFERENCE_REQUIRED.includes(s.milestone)) fail(`reference_hash is required for ${s.milestone}`);

  const status = s.customs_status ?? null;
  const isCustoms = s.milestone === Milestone.CUSTOMS_STATUS_OBSERVED;
  if (isCustoms && status === null) fail("customs_status is required for CUSTOMS_STATUS_OBSERVED");
  if (!isCustoms && status !== null) fail("customs_status is only allowed for CUSTOMS_STATUS_OBSERVED");
  if (status !== null && status !== "REALISED" && status !== "PENDING") fail(`unknown customs_status ${String(status)}`);
}

function isCalendarDate(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const m = OCCURRED_ON.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
