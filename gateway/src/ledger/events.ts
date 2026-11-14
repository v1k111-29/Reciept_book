/**
 * Chaincode event -> LedgerEvent (N4, GET /events). OWNER: P3. Pure apart from the stderr log.
 * Only MILESTONE_RECORDED_EVENT with a JSON object payload (a MilestoneEvent) is passed on; any other
 * event is skipped and logged, never thrown, so one bad event cannot end the stream.
 */
import { MILESTONE_RECORDED_EVENT, type LedgerEvent, type MilestoneEvent } from "../generated/contracts.js";
import type { ChaincodeEventLike } from "./types.js";

const utf8 = new TextDecoder();

export function toLedgerEvent(ev: ChaincodeEventLike): LedgerEvent | undefined {
  if (ev.eventName !== MILESTONE_RECORDED_EVENT) {
    console.error(`gateway: skipping chaincode event "${ev.eventName}" (tx ${ev.transactionId})`);
    return undefined;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(utf8.decode(ev.payload));
  } catch {
    payload = undefined;
  }
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    console.error(`gateway: skipping ${ev.eventName} event with a payload that is not a JSON object (tx ${ev.transactionId})`);
    return undefined;
  }
  return {
    name: MILESTONE_RECORDED_EVENT,
    block_number: Number(ev.blockNumber),
    tx_id: ev.transactionId,
    event: payload as MilestoneEvent,
  };
}

/** One SSE message: `event: <name>`, `data: <LedgerEvent JSON on one line>`, blank line. */
export function sseMessage(ev: LedgerEvent): string {
  return `event: ${ev.name}\ndata: ${JSON.stringify(ev)}\n\n`;
}
