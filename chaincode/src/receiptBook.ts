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
 * Page size for ListRecords' range query (ISS-p2-10). Drunix's SQL state DB caps a range scan
 * without pagination at 10 rows: npci/drunix@8090e0c, core/ledger/kvledger/txmgmt/statedb/
 * statesqldb/statesqldb.go:221-223. Its bookmark for the next page also looks broken there
 * (SqlScanner.GetBookmarkAndClose, same file:492) [I], so one page may be all a call can read:
 * keep this well above the number of records. A full page without a usable bookmark is an error.
 */
export const LIST_PAGE_SIZE = 1000;

/** Most pages ListRecords reads before it gives up with INTERNAL, so a call cannot loop for ever. */
export const MAX_LIST_PAGES = 100;

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

  /**
   * ListRecords() -> ShippingBillRecord[] JSON: every record, in key (sb_hash) order, from a paged
   * range query over all keys (ISS-p2-10), or INTERNAL if it cannot be sure it has every record.
   * Only keys that are sb_hashes are records; anything else is skipped. A short page ends the list.
   * A full page with no bookmark, a repeated one or no metadata may hide more rows, so it is an
   * error, never a partial list; so are more than MAX_LIST_PAGES pages. Keys seen twice are kept
   * once, and the result is sorted here: Drunix's SQL scan has no ORDER BY [I].
   */
  @Transaction(false)
  public async ListRecords(ctx: Context): Promise<string> {
    const records = new Map<string, ShippingBillRecord>();
    const bookmarks = new Set<string>();
    let bookmark = "";
    for (let page = 1; ; page++) {
      const { iterator, metadata } = await ctx.stub.getStateByRangeWithPagination("", "", LIST_PAGE_SIZE, bookmark);
      let rows = 0;
      try {
        for (;;) {
          const res = await iterator.next();
          if (res.value) rows++;
          if (res.value && HASH_PATTERN.test(res.value.key)) {
            records.set(res.value.key, JSON.parse(Buffer.from(res.value.value).toString("utf8")) as ShippingBillRecord);
          }
          if (res.done) break;
        }
      } finally {
        await iterator.close();
      }
      if ((metadata?.fetchedRecordsCount ?? rows) < LIST_PAGE_SIZE) break;
      const next = metadata?.bookmark ?? "";
      if (!next || bookmarks.has(next)) {
        throw new RuleError("INTERNAL", `ListRecords: page ${page} is full but the state DB gave no new bookmark; refusing a partial list`);
      }
      if (page >= MAX_LIST_PAGES) {
        throw new RuleError("INTERNAL", `ListRecords: more than ${MAX_LIST_PAGES} pages of ${LIST_PAGE_SIZE}; refusing a partial list`);
      }
      bookmarks.add(next);
      bookmark = next;
    }
    const keys = [...records.keys()].sort();
    return JSON.stringify(keys.map((k) => records.get(k)));
  }
}
