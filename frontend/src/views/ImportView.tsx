import { useState } from "react";
import type { Api } from "../api";
import { parseCustomsCsv, SAMPLE_CSV, type CsvParseResult } from "../csv";
import { readText } from "../fingerprint";
import { errorText, shortHash } from "../format";
import {
  CUSTOMS_IMPORT_MAX_ROWS,
  WRITER_ROLE,
  Milestone,
  type CustomsImportResult,
} from "../generated/contracts";

const SAMPLE_HREF = `data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE_CSV)}`;

export function ImportView({ api }: { api: Api }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<CsvParseResult | null>(null);
  const [result, setResult] = useState<CustomsImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function preview(source: string) {
    setResult(null);
    setError("");
    setParsed(parseCustomsCsv(source));
  }

  async function onFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      const content = await readText(file);
      setText(content);
      preview(content);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function send() {
    if (!parsed || parsed.errors.length || !parsed.rows.length || busy) return;
    setBusy(true);
    setError("");
    try {
      setResult(await api.importCustoms({ rows: parsed.rows }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const canSend = !!parsed && parsed.errors.length === 0 && parsed.rows.length > 0;

  return (
    <>
      <p>Role: {WRITER_ROLE[Milestone.CUSTOMS_STATUS_OBSERVED]}</p>
      <p>
        Import a Customs pending/realised list. Each row records a Customs status observed milestone on an existing
        shipping bill. Synthetic demo data only. At most {CUSTOMS_IMPORT_MAX_ROWS} rows.
      </p>
      <p>
        Header: <code>sb_number,port_code,sb_date,customs_status,observed_on</code>. Dates are YYYY-MM-DD; status is
        REALISED or PENDING.
      </p>
      <pre aria-label="Example CSV">{SAMPLE_CSV}</pre>
      <p>
        <a href={SAMPLE_HREF} download="customs-import-sample.csv">
          Download sample CSV
        </a>
      </p>
      <form
        aria-label="Customs import"
        onSubmit={(e) => {
          e.preventDefault();
          preview(text);
        }}
      >
        <label>
          CSV file
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
        </label>
        <label>
          Or paste CSV text
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} />
        </label>
        <button type="submit">Preview</button>
      </form>

      {parsed && parsed.errors.length > 0 && (
        <div role="alert">
          <p>Fix these lines before sending ({parsed.errors.length}):</p>
          <ul>
            {parsed.errors.map((e, i) => (
              <li key={i}>
                Line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsed && parsed.rows.length > 0 && (
        <>
          <h3>Preview ({parsed.rows.length} rows)</h3>
          <table aria-label="Import preview">
            <thead>
              <tr>
                <th>Row</th>
                <th>Shipping bill number</th>
                <th>Port code</th>
                <th>Shipping bill date</th>
                <th>Customs status</th>
                <th>Observed on</th>
              </tr>
            </thead>
            <tbody>
              {parsed.rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{r.sb_number}</td>
                  <td>{r.port_code}</td>
                  <td>{r.sb_date}</td>
                  <td>{r.customs_status}</td>
                  <td>{r.observed_on}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" disabled={!canSend || busy} onClick={() => void send()}>
            Send {parsed.rows.length} rows to the ledger
          </button>
        </>
      )}

      {error && <p role="alert">{error}</p>}

      {result && (
        <section aria-label="Import result">
          <h3>Import result</h3>
          <p>
            {result.recorded} recorded, {result.not_found} not found, {result.failed} failed (of {result.total}).
          </p>
          <table aria-label="Import rows">
            <thead>
              <tr>
                <th>Row</th>
                <th>Outcome</th>
                <th>Shipping bill</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={r.row}>
                  <td>{r.row}</td>
                  <td>{r.outcome}</td>
                  <td>{shortHash(r.sb_hash)}</td>
                  <td>{r.error ? `${r.error.code}: ${r.error.message}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
