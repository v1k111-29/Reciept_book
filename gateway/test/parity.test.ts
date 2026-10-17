import { describe, expect, it } from "vitest";
import schema from "../src/generated/contracts.schema.json";
import { parityProblems } from "../src/generated/parity";

describe("contracts parity (owner P1, must stay green)", () => {
  it("TS mirror matches contracts.py", () => {
    expect(parityProblems(schema as any)).toEqual([]);
  });
});
