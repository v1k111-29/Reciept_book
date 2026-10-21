/**
 * HTTP server. OWNER: P3. Routes must equal contracts GATEWAY_ROUTES.
 *   GET  /health   -> HealthResponse
 *   POST /submit   GatewayRequest -> GatewayResult  (CHAINCODE_WRITES only: endorse, order, commit)
 *   POST /evaluate GatewayRequest -> GatewayResult  (every other function: read-only query)
 * No business rules here: validate the request shape, forward it to the Ledger, parse the payload
 * and map failures (ledger/errors.ts). Failed responses use ERROR_HTTP_STATUS.
 */
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import {
  CHAINCODE_ARGS,
  CHAINCODE_WRITES,
  CONTRACTS_VERSION,
  ChaincodeFunction,
  ErrorCode,
  OrgRole,
  type GatewayRequest,
  type GatewayResult,
  type HealthResponse,
} from "./generated/contracts.js";
import { errorResult, toErrorResult, type ErrorResponse } from "./ledger/errors.js";
import { LedgerError, type Ledger } from "./ledger/types.js";

export type { Ledger } from "./ledger/types.js";

const MAX_BODY_BYTES = 1_000_000;
const FUNCTIONS: ReadonlySet<string> = new Set(Object.values(ChaincodeFunction));
const ROLES: ReadonlySet<string> = new Set(Object.values(OrgRole));
const REQUEST_KEYS: ReadonlySet<string> = new Set(["function", "args", "identity"]);

type Route = "submit" | "evaluate";

function send(res: ServerResponse, status: number, body: GatewayResult | HealthResponse): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function invalid(message: string): ErrorResponse {
  return errorResult(ErrorCode.VALIDATION, message);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`body larger than ${MAX_BODY_BYTES} bytes`));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/** A valid GatewayRequest for this route, or the VALIDATION error to send. */
export function parseRequest(raw: string, route: Route, ledger: Ledger): GatewayRequest | ErrorResponse {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return invalid("body is not valid JSON");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return invalid("body must be a JSON object (GatewayRequest)");
  }
  const extra = Object.keys(body).filter((k) => !REQUEST_KEYS.has(k));
  if (extra.length > 0) return invalid(`unknown field(s): ${extra.join(", ")}`);

  const { function: fn, args = [], identity } = body as Record<string, unknown>;
  if (typeof fn !== "string" || !FUNCTIONS.has(fn)) {
    return invalid(`function must be one of ${[...FUNCTIONS].join(", ")}`);
  }
  if (typeof identity !== "string" || !ROLES.has(identity)) {
    return invalid(`identity must be one of ${[...ROLES].join(", ")}`);
  }
  if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) {
    return invalid("args must be an array of strings");
  }
  const func = fn as ChaincodeFunction;
  const expected = CHAINCODE_ARGS[func];
  if (args.length !== expected.length) {
    return invalid(`${func} takes ${expected.length} arg(s) (${expected.join(", ") || "none"}), got ${args.length}`);
  }
  const isWrite = CHAINCODE_WRITES.includes(func);
  if (isWrite && route !== "submit") return invalid(`${func} writes to the ledger: use POST /submit`);
  if (!isWrite && route !== "evaluate") return invalid(`${func} is a read: use POST /evaluate`);
  if (!ledger.hasIdentity(identity as OrgRole)) {
    return invalid(`no credentials configured for identity ${identity}`);
  }
  return { function: func, args: args as string[], identity: identity as OrgRole };
}

/** Chaincode response -> parsed JSON payload (never a JSON string); empty -> null. */
function parsePayload(result: string): { ok: true; payload: unknown } | { ok: false } {
  if (result.trim() === "") return { ok: true, payload: null };
  try {
    return { ok: true, payload: JSON.parse(result) };
  } catch {
    return { ok: false };
  }
}

async function handle(route: Route, raw: string, ledger: Ledger): Promise<ErrorResponse> {
  const request = parseRequest(raw, route, ledger);
  if ("status" in request) return request;
  const { function: fn, args, identity } = request;
  try {
    const { txId, result } =
      route === "submit"
        ? await ledger.submit(fn, args, identity)
        : { txId: null, result: await ledger.evaluate(fn, args, identity) };
    const parsed = parsePayload(result);
    if (!parsed.ok) {
      const committed = txId ? ` (committed as transaction ${txId})` : "";
      return errorResult(ErrorCode.INTERNAL, `${fn} returned a response that is not JSON${committed}`, txId ?? undefined);
    }
    return { status: 200, result: { ok: true, tx_id: txId, payload: parsed.payload, error: null } };
  } catch (err) {
    if (err instanceof LedgerError) {
      if (route === "submit") return toErrorResult(err.failure);
      // /evaluate commits nothing: tx_id is always null (D-21), and a commit-stage failure can't happen.
      const { kind } = err.failure;
      if (kind === "commit" || kind === "outcome_unknown") {
        return errorResult(ErrorCode.INTERNAL, `unexpected ${kind} failure on a read`);
      }
      const mapped = toErrorResult(err.failure);
      return { ...mapped, result: { ...mapped.result, tx_id: null } };
    }
    return errorResult(ErrorCode.INTERNAL, `unexpected gateway failure: ${(err as Error)?.message ?? err}`);
  }
}

export function buildServer(ledger?: Ledger): Server {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? "/", "http://gateway").pathname;
    if (req.method === "GET" && path === "/health") {
      return send(res, 200, { status: "ok", contracts_version: CONTRACTS_VERSION });
    }
    if (req.method === "POST" && (path === "/submit" || path === "/evaluate")) {
      let raw: string;
      try {
        raw = await readBody(req);
      } catch (err) {
        const { status, result } = invalid((err as Error).message);
        return send(res, status, result);
      }
      if (!ledger) {
        const { status, result } = errorResult(ErrorCode.LEDGER_UNAVAILABLE, "gateway has no ledger configured");
        return send(res, status, result);
      }
      const { status, result } = await handle(path === "/submit" ? "submit" : "evaluate", raw, ledger);
      return send(res, status, result);
    }
    const { status, result } = invalid(`no such route: ${req.method} ${path}`);
    return send(res, status, result);
  });
}
