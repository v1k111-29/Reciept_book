/**
 * Chaincode contract. OWNER: P2. Transaction names must equal contracts ChaincodeFunction.
 *
 * State layout [I]: key = sb_hash, value = JSON ShippingBillRecord. Amounts are NOT stored
 * (private data is non-essential feature N1). ledger_time comes from ctx.stub.getTxTimestamp().
 *
 * Errors are thrown as RuleError, so the peer reports "<ErrorCode>: <message>" (Part 2.3, D-21).
 * Results are JSON per CHAINCODE_RESULT. Every endorser must build byte-identical results, so
 * nothing here reads the peer's own clock or anything else that differs between peers.
 */
import { Context, Contract, Info, Transaction } from "fabric-contract-api";
import {
  CREATE_RECORD_ROLE,
  DEFAULT_MSP_ROLES,
  HASH_PATTERN,
  MilestoneEvent,
  OrgRole,
  ShippingBillRecord,
} from "./generated/contracts";
import { checkMilestone, RuleError, validateSubmission } from "./rules";

/** Name of the chaincode event emitted by RecordMilestone; payload = the MilestoneEvent JSON (N4). */
export const MILESTONE_RECORDED_EVENT = "MilestoneRecorded";

/**
 * The transaction timestamp as ISO 8601 UTC with "Z" (ISS-p2-2). fabric-shim takes it from the
 * proposal's channel header: the submitting client's clock, the same on every endorser. So it
 * shows when the signed record was submitted, not when the real-world step happened (U-12).
 */
export function ledgerTime(ctx: Context): string {
  const ts = ctx.stub.getTxTimestamp() as unknown as { seconds: number | { toString(): string }; nanos: number };
  const seconds = typeof ts.seconds === "number" ? ts.seconds : Number(ts.seconds.toString());
  return new Date(seconds * 1000 + Math.floor((ts.nanos ?? 0) / 1e6)).toISOString();
}

function requireHash(sbHash: unknown): asserts sbHash is string {
  if (typeof sbHash !== "string" || !HASH_PATTERN.test(sbHash)) {
    throw new RuleError("VALIDATION", "sb_hash must be 64 lowercase hex characters");
  }
}

function roleOf(msp: string): OrgRole | undefined {
  return Object.prototype.hasOwnProperty.call(DEFAULT_MSP_ROLES, msp) ? DEFAULT_MSP_ROLES[msp] : undefined;
}

async function readRecord(ctx: Context, sbHash: string): Promise<ShippingBillRecord | undefined> {
  const bytes = await ctx.stub.getState(sbHash);
  if (!bytes || bytes.length === 0) return undefined;
  return JSON.parse(Buffer.from(bytes).toString("utf8")) as ShippingBillRecord;
}

async function writeRecord(ctx: Context, record: ShippingBillRecord): Promise<void> {
  await ctx.stub.putState(record.sb_hash, Buffer.from(JSON.stringify(record)));
}

@Info({ title: "ReceiptBook", description: "S14 milestone record per shipping bill" })
export class ReceiptBook extends Contract {
  /** CreateRecord(sb_hash) -> ShippingBillRecord. Only CREATE_RECORD_ROLE (else WRONG_ROLE); ALREADY_EXISTS if present. */
  @Transaction()
  public async CreateRecord(ctx: Context, sbHash: string): Promise<string> {
    requireHash(sbHash);
    const msp = ctx.clientIdentity.getMSPID();
    if (roleOf(msp) !== CREATE_RECORD_ROLE) {
      throw new RuleError("WRONG_ROLE", `only ${CREATE_RECORD_ROLE} creates records, not ${msp}`);
    }
    if (await readRecord(ctx, sbHash)) {
      throw new RuleError("ALREADY_EXISTS", "a record for this sb_hash already exists");
    }
    const record: ShippingBillRecord = {
      sb_hash: sbHash,
      bank_msp: msp,
      created_ledger_time: ledgerTime(ctx),
      events: [],
    };
    await writeRecord(ctx, record);
    return JSON.stringify(record);
  }

  /** RecordMilestone(submissionJson) -> MilestoneEvent. Validates with rules.checkMilestone, appends, emits "MilestoneRecorded". */
  @Transaction()
  public async RecordMilestone(ctx: Context, submissionJson: string): Promise<string> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(submissionJson);
    } catch {
      throw new RuleError("VALIDATION", "submission is not valid JSON");
    }
    validateSubmission(parsed);
    const submission = parsed;
    const record = await readRecord(ctx, submission.sb_hash);
    if (!record) throw new RuleError("NOT_FOUND", "no record for this sb_hash");

    const msp = ctx.clientIdentity.getMSPID();
    checkMilestone(record, submission, msp, DEFAULT_MSP_ROLES);

    const event: MilestoneEvent = {
      sb_hash: submission.sb_hash,
      milestone: submission.milestone,
      occurred_on: submission.occurred_on,
      reference_hash: submission.reference_hash ?? null,
      customs_status: submission.customs_status ?? null,
      tx_id: ctx.stub.getTxID(),
      ledger_time: ledgerTime(ctx),
      submitter_msp: msp,
      submitter_role: DEFAULT_MSP_ROLES[msp], // checkMilestone has confirmed the MSP has a role
    };
    await writeRecord(ctx, { ...record, events: [...record.events, event] });
    const json = JSON.stringify(event);
    ctx.stub.setEvent(MILESTONE_RECORDED_EVENT, Buffer.from(json));
    return json;
  }

  /** GetRecord(sb_hash) -> ShippingBillRecord JSON, or NOT_FOUND. */
  @Transaction(false)
  public async GetRecord(ctx: Context, sbHash: string): Promise<string> {
    requireHash(sbHash);
    const record = await readRecord(ctx, sbHash);
    if (!record) throw new RuleError("NOT_FOUND", "no record for this sb_hash");
    return JSON.stringify(record);
  }

  /** ListRecords() -> ShippingBillRecord[] JSON (range query over all keys). */
  @Transaction(false)
  public async ListRecords(ctx: Context): Promise<string> {
    throw new Error("NotImplemented: P2 G3");
  }
}
