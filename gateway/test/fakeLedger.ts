/** Test double for the Ledger interface. OWNER: P3. Records calls; behaviour is set per test. */
import type { ChaincodeFunction, OrgRole } from "../src/generated/contracts";
import type { Ledger } from "../src/ledger/types";

export interface Call {
  kind: "submit" | "evaluate";
  fn: ChaincodeFunction;
  args: string[];
  identity: OrgRole;
}

export class FakeLedger implements Ledger {
  calls: Call[] = [];
  identities: Set<OrgRole> = new Set(["AD_BANK", "EXPORTERS_BODY"]);
  submitImpl: (call: Call) => Promise<{ txId: string; result: string }> = async () => ({
    txId: "tx-1",
    result: JSON.stringify({ ok: "submitted" }),
  });
  evaluateImpl: (call: Call) => Promise<string> = async () => JSON.stringify({ ok: "evaluated" });

  hasIdentity(identity: OrgRole): boolean {
    return this.identities.has(identity);
  }

  submit(fn: ChaincodeFunction, args: string[], identity: OrgRole) {
    const call: Call = { kind: "submit", fn, args, identity };
    this.calls.push(call);
    return this.submitImpl(call);
  }

  evaluate(fn: ChaincodeFunction, args: string[], identity: OrgRole) {
    const call: Call = { kind: "evaluate", fn, args, identity };
    this.calls.push(call);
    return this.evaluateImpl(call);
  }
}
