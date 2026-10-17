/**
 * Shared parity check used by every TS package's tests. OWNER: P1.
 * Compares the TS mirror (contracts.ts) with contracts.schema.json (from contracts.py).
 */
import * as C from "./contracts.js";

type Schema = {
  contracts_version: string;
  hash_pattern: string;
  enums: Record<string, string[]>;
  writer_role: Record<string, string>;
  preconditions: Record<string, string[]>;
  repeatable: string[];
  reference_required: string[];
  default_msp_roles: Record<string, string>;
  backend_routes: Record<string, string>;
  gateway_routes: Record<string, string>;
  models: Record<string, { properties: Record<string, unknown> }>;
};

/** Returns a list of mismatch descriptions; empty means Python and TS agree. */
export function parityProblems(schema: Schema): string[] {
  const p: string[] = [];
  // Key order is ignored (the JSON is written with sorted keys); list order is not.
  const canon = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(canon)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, canon((v as any)[k])]))
        : v;
  const eq = (name: string, a: unknown, b: unknown) => {
    const [sa, sb] = [JSON.stringify(canon(a)), JSON.stringify(canon(b))];
    if (sa !== sb) p.push(`${name}: TS=${sa} PY=${sb}`);
  };
  eq("contracts_version", C.CONTRACTS_VERSION, schema.contracts_version);
  eq("hash_pattern", C.HASH_PATTERN.source, schema.hash_pattern);
  const enums: Record<string, Record<string, string>> = {
    OrgRole: C.OrgRole, Milestone: C.Milestone, CustomsStatus: C.CustomsStatus,
    CauseBucket: C.CauseBucket, ChaincodeFunction: C.ChaincodeFunction, ErrorCode: C.ErrorCode,
  };
  for (const [name, values] of Object.entries(schema.enums)) {
    eq(`enum ${name}`, enums[name] ? Object.values(enums[name]) : undefined, values);
  }
  eq("writer_role", C.WRITER_ROLE, schema.writer_role);
  eq("preconditions", C.PRECONDITIONS, schema.preconditions);
  eq("repeatable", [...C.REPEATABLE].sort(), schema.repeatable);
  eq("reference_required", [...C.REFERENCE_REQUIRED].sort(), schema.reference_required);
  eq("default_msp_roles", C.DEFAULT_MSP_ROLES, schema.default_msp_roles);
  eq("backend_routes", C.BACKEND_ROUTES, schema.backend_routes);
  eq("gateway_routes", C.GATEWAY_ROUTES, schema.gateway_routes);
  for (const [model, def] of Object.entries(schema.models)) {
    eq(`fields ${model}`, [...(C.MODEL_FIELDS[model] ?? [])].sort(), Object.keys(def.properties).sort());
  }
  return p;
}
