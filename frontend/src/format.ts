import { ApiError } from "./api";

export function formatMilestone(value: string) {
  return value.replaceAll("_", " ");
}

/** "PAYMENT_RECEIVED" -> "Payment received". */
export function milestoneInWords(value: string) {
  const w = formatMilestone(value).toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** First 12 characters of a hash, as the timeline shows it. */
export function shortHash(hash: string | null | undefined) {
  return hash ? `${hash.slice(0, 12)}…` : "";
}

export function errorText(e: unknown) {
  if (e instanceof ApiError && e.code === "OUTCOME_UNKNOWN") {
    return `OUTCOME_UNKNOWN: ${e.message}. The write may have been recorded. Check the timeline before retrying.`;
  }
  if (e instanceof ApiError) return `${e.code}: ${e.message}`;
  return e instanceof Error ? e.message : String(e);
}
