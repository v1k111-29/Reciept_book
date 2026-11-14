/**
 * Map a LedgerFailure to a failed GatewayResult and its HTTP status. Pure.
 *
 * Rules: contracts GatewayResult docstring (D-20, D-21), REQ-p1-21, REQ-p1-30, REQ-p1-33.
 * A chaincode error reaches us in each endorsing peer's detail as
 * "chaincode response 500, <ErrorCode>: <message>" (seen on Drunix, 18 Oct 2026).
 */
import { ERROR_HTTP_STATUS, ErrorCode, type GatewayResult } from "../generated/contracts.js";
import type { LedgerFailure } from "./types.js";

const CHAINCODE_PREFIX = /chaincode response \d+, /;
const KNOWN_CODES: ReadonlySet<string> = new Set(Object.values(ErrorCode));

export interface ErrorResponse {
  status: number;
  result: GatewayResult;
}

export function errorResult(code: ErrorCode, message: string, txId?: string): ErrorResponse {
  return {
    status: ERROR_HTTP_STATUS[code],
    result: { ok: false, tx_id: txId ?? null, error: { code, message } },
  };
}

/** The chaincode's own message from a peer detail, and its ErrorCode if it starts with a known one. */
function parseDetail(message: string): { text: string; code?: ErrorCode } {
  const match = CHAINCODE_PREFIX.exec(message);
  const text = match ? message.slice(match.index + match[0].length) : message;
  const code = /^([A-Z_]+): /.exec(text)?.[1];
  return code !== undefined && KNOWN_CODES.has(code) ? { text, code: code as ErrorCode } : { text };
}

function fromEndorse(messages: string[], txId?: string): ErrorResponse {
  const parsed = messages.map(parseDetail);
  const codes = [...new Set(parsed.flatMap((p) => (p.code ? [p.code] : [])))];
  const all = parsed.map((p) => p.text).join(" | ") || "endorsement failed with no details";
  if (codes.length === 1) {
    return errorResult(codes[0], parsed.find((p) => p.code === codes[0])!.text, txId);
  }
  if (codes.length > 1) {
    return errorResult(ErrorCode.ENDORSEMENT_FAILED, `peers disagree: ${all}`, txId);
  }
  return errorResult(ErrorCode.INTERNAL, all, txId);
}

function fromCommit(commitCode: string, txId: string): ErrorResponse {
  const message = `transaction ${txId} invalidated at commit: ${commitCode}`;
  if (commitCode === "MVCC_READ_CONFLICT") return errorResult(ErrorCode.MVCC_CONFLICT, message, txId);
  if (commitCode === "ENDORSEMENT_POLICY_FAILURE") return errorResult(ErrorCode.ENDORSEMENT_FAILED, message, txId);
  return errorResult(ErrorCode.INTERNAL, message, txId);
}

export function toErrorResult(failure: LedgerFailure): ErrorResponse {
  switch (failure.kind) {
    case "endorse":
      return fromEndorse(failure.messages, failure.txId);
    case "commit":
      return fromCommit(failure.commitCode, failure.txId);
    case "outcome_unknown":
      return errorResult(
        ErrorCode.OUTCOME_UNKNOWN,
        `transaction ${failure.txId} was sent but its commit status is unknown; it may still commit`,
        failure.txId,
      );
    case "unavailable":
      return errorResult(ErrorCode.LEDGER_UNAVAILABLE, failure.message, failure.txId);
  }
}
