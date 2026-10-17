/**
 * Pure ledger rules for one shipping-bill record. OWNER: P2.
 *
 * Keep ALL decision logic here (no Fabric imports) so it can be unit-tested without a
 * network. receiptBook.ts only reads/writes state and calls these functions.
 * The rules must match contracts.py: WRITER_ROLE, PRECONDITIONS, REPEATABLE,
 * REFERENCE_REQUIRED, and "only the record's own bank writes bank milestones".
 * Spec: test/rules.spec.test.ts
 */
import { ErrorCode, MilestoneSubmission, OrgRole, ShippingBillRecord } from "./generated/contracts";

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
  throw new Error("NotImplemented: P2 G2");
}
