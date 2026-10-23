import type {
  CreateRecordRequest,
  ErrorBody,
  ErrorCode,
  MetricsSummary,
  MilestoneRequest,
  TimelineView,
  TxReceipt,
} from "./generated/contracts";

const base = "/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    const body = data as ErrorBody;
    const error = new Error(body.message) as Error & { code: ErrorCode };
    error.code = body.code;
    throw error;
  }

  return data as T;
}

export function createRecord(req: CreateRecordRequest): Promise<TxReceipt> {
  return request<TxReceipt>("/records", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function recordMilestone(
  sbHash: string,
  req: MilestoneRequest,
): Promise<TxReceipt> {
  return request<TxReceipt>(`/records/${encodeURIComponent(sbHash)}/milestones`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export function getTimeline(sbHash: string): Promise<TimelineView> {
  return request<TimelineView>(`/records/${encodeURIComponent(sbHash)}`);
}

export function getMetrics(): Promise<MetricsSummary> {
  return request<MetricsSummary>("/metrics");
}

export function listRecords(): Promise<TimelineView[]> {
  return request<TimelineView[]>("/records");
}
