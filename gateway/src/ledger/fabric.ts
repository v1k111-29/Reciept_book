/**
 * The real Ledger: Drunix through the Fabric Gateway API. OWNER: P3.
 *
 * Connect pattern from Drunix's asset-transfer-basic/application-gateway-typescript sample, which worked
 * against both peer types of our network with @hyperledger/fabric-gateway 1.13.0 (U-02, docs/logs/p3.md).
 * Fabric errors are converted to LedgerError here; ledger/errors.ts maps those to GatewayResult.
 */
import { createPrivateKey } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as grpc from "@grpc/grpc-js";
import { connect, hash, signers, StatusCode, type Contract, type Gateway } from "@hyperledger/fabric-gateway";
import type { GatewayConfig, IdentityConfig } from "../config.js";
import type { ChaincodeFunction, OrgRole } from "../generated/contracts.js";
import { LedgerError, type Ledger, type LedgerFailure } from "./types.js";

/**
 * gRPC deadlines in ms. The submit path (endorse + submit + commit status = 9 s) stays under the 10 s
 * timeout of p4's HttpGateway, so a slow commit reaches the backend as OUTCOME_UNKNOWN, not as a
 * client-side LEDGER_UNAVAILABLE (REQ-p3-6). MISMATCH_RETRY below adds at most 0.9 s (9.9 s worst case).
 * [I] tuned on the emulated test network.
 */
export const DEADLINES_MS = { evaluate: 5000, endorse: 3000, submit: 2000, commitStatus: 4000 } as const;

const STATUS_NAMES: Readonly<Record<number, string>> = Object.fromEntries(
  Object.entries(StatusCode).map(([name, code]) => [code, name]),
);
const NOT_REACHED: ReadonlySet<number> = new Set([grpc.status.UNAVAILABLE, grpc.status.DEADLINE_EXCEEDED]);
const utf8 = new TextDecoder();

/** Name of a Fabric transaction validation code, e.g. 11 -> "MVCC_READ_CONFLICT". */
export function statusName(code: number): string {
  return STATUS_NAMES[code] ?? `UNKNOWN_STATUS_${code}`;
}

interface FabricErrorLike {
  name?: string;
  message?: string;
  code?: number;
  details?: { message: string }[];
  transactionId?: string;
}

/** Fabric error -> LedgerFailure, or undefined for errors that aren't Fabric's (the server answers INTERNAL). */
export function toLedgerFailure(err: unknown): LedgerFailure | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as FabricErrorLike;
  const txId = e.transactionId;
  const messages = (e.details ?? []).map((d) => d.message);
  const notReached = messages.length === 0 && e.code !== undefined && NOT_REACHED.has(e.code);
  const message = e.message ?? String(err);
  switch (e.name) {
    case "EndorseError":
    case "GatewayError":
      // Endorsement/evaluation failed before anything was ordered.
      if (notReached) return { kind: "unavailable", message, txId };
      return { kind: "endorse", messages: messages.length > 0 ? messages : [message], txId };
    case "SubmitError":
      // Orderer unreachable: not ordered [I]. Any other failure may have been ordered: never call it safe.
      if (e.code === grpc.status.UNAVAILABLE && txId) return { kind: "unavailable", message, txId };
      return txId ? { kind: "outcome_unknown", txId } : { kind: "unavailable", message };
    case "CommitStatusError":
      return txId ? { kind: "outcome_unknown", txId } : { kind: "unavailable", message };
    default:
      return undefined;
  }
}

function rethrow(err: unknown): never {
  const failure = toLedgerFailure(err);
  throw failure ? new LedgerError(failure) : err;
}

type ContractLike = Pick<Contract, "submitAsync" | "evaluateTransaction">;

/**
 * Retry of an endorsement whose peers returned different results (ISS-p3-10). Seen live on Drunix (run
 * 40278900530): a write right after another on the same key, through the other org, is endorsed while the
 * first write has committed on one org's peer but not yet on the other's, so the two read different
 * versions and the peer gateway answers "ProposalResponsePayloads do not match". Nothing was sent to the
 * orderer, so a fresh proposal (new tx id) cannot record twice. Any other failure is never retried here.
 *
 * Time bound: the next attempt starts only while failed attempts plus waits have used at most budgetMs, so
 * the worst case is budgetMs + one full attempt (DEADLINES_MS endorse + submit + commit status = 9 s)
 * = 9.9 s, still under p4's 10 s timeout. [I] a mismatch fails in milliseconds, so the 2 waits fit.
 */
export const MISMATCH_RETRY = { attempts: 3, waitMs: 300, budgetMs: 900 } as const;
export type MismatchRetry = { readonly attempts: number; readonly waitMs: number; readonly budgetMs: number };

const PAYLOADS_DO_NOT_MATCH = /ProposalResponsePayloads do not match/i;

/** True for an endorse-stage failure whose peers' results differ (never for anything ordered). */
export function isEndorseMismatch(err: unknown): boolean {
  if ((err as FabricErrorLike | null)?.name !== "EndorseError") return false;
  const failure = toLedgerFailure(err);
  return failure?.kind === "endorse" && failure.messages.some((m) => PAYLOADS_DO_NOT_MATCH.test(m));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Endorse, order, then wait for the commit status, so an invalidated commit and an unknown one differ. */
export async function submitVia(
  contract: ContractLike,
  fn: string,
  args: string[],
  retry: MismatchRetry = MISMATCH_RETRY,
): Promise<{ txId: string; result: string }> {
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    try {
      // submitAsync builds a new proposal, so each attempt has its own tx id.
      const submitted = await contract.submitAsync(fn, { arguments: args });
      const result = utf8.decode(submitted.getResult());
      const status = await submitted.getStatus();
      if (!status.successful) {
        throw new LedgerError({ kind: "commit", commitCode: statusName(status.code), txId: status.transactionId });
      }
      return { txId: status.transactionId, result };
    } catch (err) {
      if (err instanceof LedgerError) throw err;
      const inBudget = Date.now() - started + retry.waitMs <= retry.budgetMs;
      if (attempt < retry.attempts && inBudget && isEndorseMismatch(err)) {
        const txId = (err as FabricErrorLike).transactionId;
        console.warn(`gateway: ${fn} tx ${txId} endorsement results differ (attempt ${attempt}/${retry.attempts}); retrying`);
        await sleep(retry.waitMs);
        continue;
      }
      return rethrow(err);
    }
  }
}

export async function evaluateVia(contract: ContractLike, fn: string, args: string[]): Promise<string> {
  try {
    return utf8.decode(await contract.evaluateTransaction(fn, ...args));
  } catch (err) {
    return rethrow(err);
  }
}

async function read(path: string, what: string): Promise<Buffer> {
  try {
    return await readFile(path);
  } catch (err) {
    throw new Error(`gateway ledger: cannot read ${what} ${path}: ${(err as Error).message}`);
  }
}

interface Connection {
  client: grpc.Client;
  gateway: Gateway;
  contract: Contract;
}

export class FabricLedger implements Ledger {
  private constructor(private readonly connections: Map<OrgRole, Connection>) {}

  /** One gRPC client + Gateway per configured role. Reads the cert/key files now; connects lazily. */
  static async connect(config: GatewayConfig): Promise<FabricLedger> {
    const connections = new Map<OrgRole, Connection>();
    const entries = Object.entries(config.identities) as [OrgRole, IdentityConfig][];
    for (const [role, id] of entries) {
      const [tlsCert, cert, key] = await Promise.all([
        read(id.tlsCertPath, `${role} TLS CA cert`),
        read(id.certPath, `${role} certificate`),
        read(id.keyPath, `${role} private key`),
      ]);
      const client = new grpc.Client(
        id.peerEndpoint,
        grpc.credentials.createSsl(tlsCert),
        id.peerHostAlias ? { "grpc.ssl_target_name_override": id.peerHostAlias } : {},
      );
      const deadline = (ms: number) => () => ({ deadline: Date.now() + ms });
      const gateway = connect({
        client,
        identity: { mspId: id.mspId, credentials: cert },
        signer: signers.newPrivateKeySigner(createPrivateKey(key)),
        hash: hash.sha256,
        evaluateOptions: deadline(DEADLINES_MS.evaluate),
        endorseOptions: deadline(DEADLINES_MS.endorse),
        submitOptions: deadline(DEADLINES_MS.submit),
        commitStatusOptions: deadline(DEADLINES_MS.commitStatus),
      });
      const contract = gateway.getNetwork(config.channel).getContract(config.chaincode);
      connections.set(role, { client, gateway, contract });
    }
    return new FabricLedger(connections);
  }

  hasIdentity(identity: OrgRole): boolean {
    return this.connections.has(identity);
  }

  submit(fn: ChaincodeFunction, args: string[], identity: OrgRole): Promise<{ txId: string; result: string }> {
    return submitVia(this.contract(identity), fn, args);
  }

  evaluate(fn: ChaincodeFunction, args: string[], identity: OrgRole): Promise<string> {
    return evaluateVia(this.contract(identity), fn, args);
  }

  close(): void {
    for (const { gateway, client } of this.connections.values()) {
      gateway.close();
      client.close();
    }
  }

  private contract(identity: OrgRole): Contract {
    const connection = this.connections.get(identity);
    if (!connection) throw new Error(`no ledger connection for ${identity}`);
    return connection.contract;
  }
}
