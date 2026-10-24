/**
 * Typed client for the backend. OWNER: P5. Paths follow contracts BACKEND_ROUTES, under /api.
 * Spec: test/api.spec.test.ts
 */
import type {
  CreateRecordRequest,
  ErrorBody,
  ErrorCode,
  MetricsSummary,
  MilestoneRequest,
  TimelineView,
  TxReceipt,
} from "./generated/contracts";

const BASE = "/api";

/** Error thrown for a non-2xx response; `code` is the contract ErrorCode from the ErrorBody. */
export class ApiError extends Error {
  readonly code: ErrorCode | "NETWORK";
  readonly status: number;
  constructor(code: ErrorCode | "NETWORK", message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new ApiError("NETWORK", e instanceof Error ? e.message : "network error", 0);
  }
  if (!res.ok) {
    let err: Partial<ErrorBody> = {};
    try {
      err = (await res.json()) as Partial<ErrorBody>;
    } catch {
      /* body was not JSON */
    }
    throw new ApiError(err.code ?? "INTERNAL", err.message ?? res.statusText, res.status);
  }
  return (await res.json()) as T;
}

export function createRecord(req: CreateRecordRequest): Promise<TxReceipt> {
  return call("POST", "/records", req);
}
export function recordMilestone(sbHash: string, req: MilestoneRequest): Promise<TxReceipt> {
  return call("POST", `/records/${encodeURIComponent(sbHash)}/milestones`, req);
}
export function getTimeline(sbHash: string): Promise<TimelineView> {
  return call("GET", `/records/${encodeURIComponent(sbHash)}`);
}
export function listRecords(): Promise<TimelineView[]> {
  return call("GET", "/records");
}
export function getMetrics(): Promise<MetricsSummary> {
  return call("GET", "/metrics");
}

export interface Api {
  createRecord: typeof createRecord;
  recordMilestone: typeof recordMilestone;
  getTimeline: typeof getTimeline;
  listRecords: typeof listRecords;
  getMetrics: typeof getMetrics;
}
export const api: Api = { createRecord, recordMilestone, getTimeline, listRecords, getMetrics };
