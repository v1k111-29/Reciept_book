/**
 * Typed client for the backend. OWNER: P5. Paths follow contracts BACKEND_ROUTES, under /api.
 * Spec: test/api.spec.test.ts
 */
import { MILESTONE_RECORDED_EVENT } from "./generated/contracts";
import type {
  CreateRecordRequest,
  CustomsImportRequest,
  CustomsImportResult,
  LedgerEvent,
  ReferenceCheckRequest,
  ReferenceCheckResult,
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

export function importCustoms(req: CustomsImportRequest): Promise<CustomsImportResult> {
  return call("POST", "/customs/import", req);
}
export function checkReference(sbHash: string, req: ReferenceCheckRequest): Promise<ReferenceCheckResult> {
  return call("POST", `/records/${encodeURIComponent(sbHash)}/reference-check`, req);
}

/**
 * Live ledger events over server-sent events. Returns an unsubscribe. A no-op where EventSource
 * does not exist. Malformed event data is ignored.
 */
export function subscribeEvents(
  onEvent: (e: LedgerEvent) => void,
  onStatus?: (live: boolean) => void,
): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource(`${BASE}/events`);
  source.onopen = () => onStatus?.(true);
  source.onerror = () => onStatus?.(false);
  source.addEventListener(MILESTONE_RECORDED_EVENT, (ev) => {
    try {
      const parsed = JSON.parse((ev as MessageEvent).data) as LedgerEvent;
      if (parsed && typeof parsed === "object" && parsed.event && typeof parsed.event.sb_hash === "string") onEvent(parsed);
    } catch {
      /* ignore malformed data */
    }
  });
  return () => source.close();
}

export interface Api {
  createRecord: typeof createRecord;
  recordMilestone: typeof recordMilestone;
  getTimeline: typeof getTimeline;
  listRecords: typeof listRecords;
  getMetrics: typeof getMetrics;
  importCustoms: typeof importCustoms;
  checkReference: typeof checkReference;
  subscribeEvents: typeof subscribeEvents;
}
export const api: Api = { createRecord, recordMilestone,
  getTimeline,
  listRecords,
  getMetrics,
  importCustoms,
  checkReference,
  subscribeEvents,
};
