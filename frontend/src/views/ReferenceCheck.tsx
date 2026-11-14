import { useState } from "react";
import type { Api } from "../api";
import { fileFingerprint } from "../fingerprint";
import { errorText, milestoneInWords, shortHash } from "../format";
import { Milestone, REFERENCE_REQUIRED, type ReferenceCheckResult } from "../generated/contracts";

export function ReferenceCheck({ api, sbHash }: { api: Api; sbHash: string }) {
  const options = REFERENCE_REQUIRED as readonly Milestone[];
  const [milestone, setMilestone] = useState<Milestone>(options[0]);
  const [reference, setReference] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [result, setResult] = useState<ReferenceCheckResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      setReference(await fileFingerprint(file));
      setFileNote(`Fingerprint computed in this browser from ${file.name}. The file was not uploaded.`);
      setResult(null);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function check(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.checkReference(sbHash, { milestone, reference }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={check} aria-label="Check a document or reference">
      <h3>Check a document or reference</h3>
      <label>
        Milestone to check
        <select value={milestone} onChange={(e) => setMilestone(e.target.value as Milestone)}>
          {options.map((m) => (
            <option key={m} value={m}>
              {milestoneInWords(m)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Raw reference to check
        <input value={reference} onChange={(e) => setReference(e.target.value)} required />
      </label>
      <label>
        Or choose a document
        <input type="file" onChange={onFile} />
      </label>
      <p>The document stays on your computer. Only its SHA-256 fingerprint is sent for the check.</p>
      {fileNote && <p>{fileNote}</p>}
      <button type="submit" disabled={busy}>
        Check against the ledger
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <p data-testid="reference-check-result">
          {!result.recorded
            ? `No ${milestoneInWords(result.milestone).toLowerCase()} recorded yet`
            : result.matches
              ? `Matches the ledger (recorded ${result.ledger_time}, tx ${shortHash(result.tx_id)})`
              : "Does NOT match the ledger"}
        </p>
      )}
    </form>
  );
}
