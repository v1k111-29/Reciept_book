import { describe, expect, it } from "vitest";
import schema from "../src/generated/contracts.schema.json";
import { parityProblems } from "../src/generated/parity";
import { ChaincodeFunction } from "../src/generated/contracts";
import { ReceiptBook } from "../src/receiptBook";

describe("contracts parity (owner P1, must stay green)", () => {
  it("TS mirror matches contracts.py", () => {
    expect(parityProblems(schema as any)).toEqual([]);
  });
  it("chaincode exposes every ChaincodeFunction", () => {
    for (const fn of Object.values(ChaincodeFunction)) {
      expect(typeof (ReceiptBook.prototype as any)[fn]).toBe("function");
    }
  });
});
