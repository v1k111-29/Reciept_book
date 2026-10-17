/**
 * HTTP server. OWNER: P3. Routes must equal contracts GATEWAY_ROUTES.
 *   GET  /health   -> {"status":"ok","contracts_version":...}            (done at G0)
 *   POST /submit   GatewayRequest -> GatewayResult  (endorse, order, commit)  G2
 *   POST /evaluate GatewayRequest -> GatewayResult  (read-only query)          G2
 * Ledger errors are mapped to contracts ErrorCode (chaincode RuleError messages start with "CODE: ").
 */
import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";
import { CONTRACTS_VERSION } from "./generated/contracts.js";

export interface Ledger {
  submit(fn: string, args: string[], identity: string): Promise<{ txId: string; payload: unknown }>;
  evaluate(fn: string, args: string[], identity: string): Promise<unknown>;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function buildServer(_ledger?: Ledger): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { status: "ok", contracts_version: CONTRACTS_VERSION });
    }
    if (req.method === "POST" && (req.url === "/submit" || req.url === "/evaluate")) {
      return send(res, 501, { ok: false, error: { code: "LEDGER_UNAVAILABLE", message: "P3: not implemented (G2)" } });
    }
    return send(res, 404, { ok: false, error: { code: "NOT_FOUND", message: "no such route" } });
  });
}
