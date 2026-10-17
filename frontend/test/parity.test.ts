import schema from "../src/generated/contracts.schema.json";
import { parityProblems } from "../src/generated/parity";

test("contracts parity: TS mirror matches contracts.py (owner P1)", () => {
  expect(parityProblems(schema as any)).toEqual([]);
});
