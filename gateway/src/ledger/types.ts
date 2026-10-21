/**
 * What the HTTP server needs from the ledger. OWNER: P3.
 *
 * The real implementation (Fabric Gateway, G2 part 2) converts Fabric's EndorseError, SubmitError,
 * CommitError and CommitStatusError into a LedgerError, so server.ts never sees Fabric types and
 * tests can use a fake Ledger.
 */
import type { ChaincodeFunction, OrgRole } from "../generated/contracts.js";

export interface Ledger {
  /** True if credentials are configured for this role (else the request gets VALIDATION, D-21). */
  hasIdentity(identity: OrgRole): boolean;
  /** Endorse, order and commit. `result` is the chaincode's raw UTF-8 response. */
  submit(fn: ChaincodeFunction, args: string[], identity: OrgRole): Promise<{ txId: string; result: string }>;
  /** Read-only query; nothing is committed. Returns the chaincode's raw UTF-8 response. */
  evaluate(fn: ChaincodeFunction, args: string[], identity: OrgRole): Promise<string>;
}

export type LedgerFailure =
  /** Endorsement failed; `messages` are the peers' details[].message (chaincode errors arrive here). */
  | { kind: "endorse"; messages: string[]; txId?: string }
  /** Ordered but invalidated at commit; `commitCode` is the Fabric TxValidationCode name. */
  | { kind: "commit"; commitCode: string; txId: string }
  /** Sent with a tx id, but its commit status is not known: it may still commit. */
  | { kind: "outcome_unknown"; txId: string }
  /** A peer or the orderer could not be reached. */
  | { kind: "unavailable"; message: string; txId?: string };

export class LedgerError extends Error {
  constructor(readonly failure: LedgerFailure) {
    super(`ledger ${failure.kind} failure`);
    this.name = "LedgerError";
  }
}
