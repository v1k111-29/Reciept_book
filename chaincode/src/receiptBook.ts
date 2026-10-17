/**
 * Chaincode contract. OWNER: P2. Transaction names must equal contracts ChaincodeFunction.
 *
 * State layout [I]: key = sb_hash, value = JSON ShippingBillRecord. Amounts are NOT stored
 * (private data is non-essential feature N1). ledger_time comes from ctx.stub.getTxTimestamp().
 */
import { Context, Contract, Info, Transaction } from "fabric-contract-api";

@Info({ title: "ReceiptBook", description: "S14 milestone record per shipping bill" })
export class ReceiptBook extends Contract {
  /** CreateRecord(sb_hash): only an AD_BANK org; fails ALREADY_EXISTS if present. */
  @Transaction()
  public async CreateRecord(ctx: Context, sbHash: string): Promise<string> {
    throw new Error("NotImplemented: P2 G2");
  }

  /** RecordMilestone(submissionJson): validates with rules.checkMilestone, appends event, emits event "MilestoneRecorded". */
  @Transaction()
  public async RecordMilestone(ctx: Context, submissionJson: string): Promise<string> {
    throw new Error("NotImplemented: P2 G2");
  }

  /** GetRecord(sb_hash) -> ShippingBillRecord JSON, or NOT_FOUND. */
  @Transaction(false)
  public async GetRecord(ctx: Context, sbHash: string): Promise<string> {
    throw new Error("NotImplemented: P2 G2");
  }

  /** ListRecords() -> ShippingBillRecord[] JSON (range query over all keys). */
  @Transaction(false)
  public async ListRecords(ctx: Context): Promise<string> {
    throw new Error("NotImplemented: P2 G3");
  }
}
