/**
 * Typed client for the backend. OWNER: P5. Paths follow contracts BACKEND_ROUTES, under /api.
 * Spec: test/api.spec.test.ts
 */
import type { CreateRecordRequest, MetricsSummary, MilestoneRequest, TimelineView, TxReceipt } from "./generated/contracts";

export async function createRecord(_req: CreateRecordRequest): Promise<TxReceipt> {
  throw new Error("NotImplemented: P5 G2");
}
export async function recordMilestone(_sbHash: string, _req: MilestoneRequest): Promise<TxReceipt> {
  throw new Error("NotImplemented: P5 G2");
}
export async function getTimeline(_sbHash: string): Promise<TimelineView> {
  throw new Error("NotImplemented: P5 G2");
}
export async function getMetrics(): Promise<MetricsSummary> {
  throw new Error("NotImplemented: P5 G3");
}
