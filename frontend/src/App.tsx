import { useCallback, useEffect, useRef, useState } from "react";
import { api as realApi, type Api } from "./api";
import { fileFingerprint } from "./fingerprint";
import { errorText, formatMilestone, milestoneInWords, shortHash } from "./format";
import { ImportView } from "./views/ImportView";
import { ReferenceCheck } from "./views/ReferenceCheck";
import {
  CONTRACTS_VERSION,
  CustomsStatus,
  HASH_PATTERN,
  Milestone,
  OrgRole,
  REFERENCE_REQUIRED,
  WRITER_ROLE,
  type CauseBucket,
  type LedgerEvent,
  type MetricsSummary,
  type TimelineView,
} from "./generated/contracts";

type View = "bank" | "exporters" | "import" | "timeline" | "metrics";

/** A burst of ledger events becomes one refresh: a counter plus the record hashes that changed. */
interface Refresh {
  tick: number;
  hashes: string[];
}

const REFRESH_DEBOUNCE_MS = 500;

const ALL_MILESTONES = Object.values(Milestone) as Milestone[];

const CAUSE_WORDS: Record<CauseBucket, string> = {
  CONSISTENT: "All records agree",
  NO_PAYMENT_RECORDED: "No payment recorded yet",
  EXPORTER_LINKAGE_MISSING: "Exporter linkage missing",
  BANK_NOT_MARKED_OFF: "Bank has not marked this off",
  DOWNSTREAM_SYNC: "Marked off by the bank; Customs not yet updated",
};

export { formatMilestone };

export function causeInWords(bucket: CauseBucket) {
  return CAUSE_WORDS[bucket] ?? formatMilestone(bucket);
}

function Desk({ role, api, onDone }: { role: OrgRole; api: Api; onDone: (sbHash: string) => void }) {
  const allowed = ALL_MILESTONES.filter((m) => WRITER_ROLE[m] === role);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [sbHash, setSbHash] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [reference, setReference] = useState("");
  const [status, setStatus] = useState<CustomsStatus>(CustomsStatus.PENDING);
  const [message, setMessage] = useState("");
  const [sbNumber, setSbNumber] = useState("");
  const [portCode, setPortCode] = useState("");
  const [sbDate, setSbDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [fileNote, setFileNote] = useState("");

  async function useFileFingerprint(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
      setReference(await fileFingerprint(file));
      setFileNote(`SHA-256 of ${file.name} filled in. The file was not uploaded.`);
    } catch (e) {
      setFileNote(errorText(e));
    }
  }

  async function submitMilestone(ev: React.FormEvent) {
    ev.preventDefault();
    if (!milestone || busy) return;
    setBusy(true);
    try {
      const receipt = await api.recordMilestone(sbHash, {
        milestone,
        occurred_on: occurredOn,
        acting_as: role,
        reference: REFERENCE_REQUIRED.includes(milestone) ? reference : undefined,
        customs_status: milestone === Milestone.CUSTOMS_STATUS_OBSERVED ? status : undefined,
      });
      setMessage(`Recorded in transaction ${receipt.tx_id}`);
      onDone(receipt.sb_hash);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate(ev: React.FormEvent) {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const receipt = await api.createRecord({ sb_number: sbNumber, port_code: portCode, sb_date: sbDate });
      setSbHash(receipt.sb_hash);
      setMessage(`Record created: ${receipt.sb_hash}`);
      onDone(receipt.sb_hash);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <p>Role: {role}</p>
      {role === OrgRole.AD_BANK && (
        <form onSubmit={submitCreate} aria-label="Create record">
          <h3>New shipping bill</h3>
          <label>
            Shipping bill number
            <input value={sbNumber} onChange={(e) => setSbNumber(e.target.value)} maxLength={20} required />
          </label>
          <label>
            Port code
            <input value={portCode} onChange={(e) => setPortCode(e.target.value)} maxLength={10} required />
          </label>
          <label>
            Shipping bill date
            <input type="date" value={sbDate} onChange={(e) => setSbDate(e.target.value)} required />
          </label>
          <button type="submit" disabled={busy}>
            Create record
          </button>
        </form>
      )}
      <p>Select a milestone to record for a shipping bill.</p>
      <ul>
        {allowed.map((m) => (
          <li key={m}>
            <button type="button" aria-pressed={milestone === m} onClick={() => setMilestone(m)}>
              {formatMilestone(m)}
            </button>
          </li>
        ))}
      </ul>
      {milestone && (
        <form onSubmit={submitMilestone} aria-label="Record milestone">
          <h3>{formatMilestone(milestone)}</h3>
          <label>
            Shipping bill hash
            <input value={sbHash} onChange={(e) => setSbHash(e.target.value.trim())} pattern={HASH_PATTERN.source} required />
          </label>
          <label>
            Occurred on
            <input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} required />
          </label>
          {REFERENCE_REQUIRED.includes(milestone) && (
            <>
              <label>
                Reference (hashed before it leaves the server)
                <input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={64} required />
              </label>
              <label>
                Optional: use a file's fingerprint (SHA-256) instead
                <input type="file" onChange={useFileFingerprint} />
              </label>
              {fileNote && <p>{fileNote}</p>}
            </>
          )}
          {milestone === Milestone.CUSTOMS_STATUS_OBSERVED && (
            <label>
              Customs status
              <select value={status} onChange={(e) => setStatus(e.target.value as CustomsStatus)}>
                {Object.values(CustomsStatus).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="submit" disabled={busy}>
            Record milestone
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </>
  );
}

function Timeline({ view, api }: { view: TimelineView; api: Api }) {
  return (
    <article>
      <p>Shipping bill: {view.record.sb_hash.slice(0, 12)}…</p>
      <ol>
        {[...view.record.events]
          .sort((a, b) => Date.parse(a.ledger_time) - Date.parse(b.ledger_time))
          .map((event) => (
            <li key={event.tx_id}>
              <strong>{formatMilestone(event.milestone)}</strong>
              <p>Occurred on: {event.occurred_on}</p>
              <p>Recorded on ledger: {event.ledger_time}</p>
              <p>Signed by: {event.submitter_role}</p>
            </li>
          ))}
      </ol>
      <h3>Cause assessment</h3>
      <p>{causeInWords(view.assessment.bucket)}</p>
      <p>{view.assessment.explanation}</p>
      <ReferenceCheck api={api} sbHash={view.record.sb_hash} />
    </article>
  );
}

function TimelinePage({ api, focus, refresh }: { api: Api; focus: string; refresh: Refresh }) {
  const [records, setRecords] = useState<TimelineView[]>([]);
  const [lookup, setLookup] = useState(focus);
  const [found, setFound] = useState<TimelineView | null>(null);
  const [error, setError] = useState("");

  const show = useCallback(
    async (sbHash: string) => {
      try {
        setFound(await api.getTimeline(sbHash));
        setError("");
      } catch (e) {
        setFound(null);
        setError(errorText(e));
      }
    },
    [api],
  );

  useEffect(() => {
    api.listRecords().then(setRecords).catch((e) => setError(errorText(e)));
  }, [api]);

  // Live events: reload the list, and the open record if the event touched it.
  const foundHash = found?.record.sb_hash;
  useEffect(() => {
    if (refresh.tick === 0) return;
    api.listRecords().then(setRecords).catch((e) => setError(errorText(e)));
    if (foundHash && refresh.hashes.includes(foundHash)) void show(foundHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh.tick]);

  // A record just written on a desk opens straight away.
  useEffect(() => {
    if (focus) void show(focus);
  }, [focus, show]);

  function find(ev: React.FormEvent) {
    ev.preventDefault();
    const sbHash = lookup.trim();
    if (!HASH_PATTERN.test(sbHash)) {
      setError("Enter a 64-character shipping bill hash (0-9, a-f).");
      return;
    }
    void show(sbHash);
  }

  const shown = found ? [found] : records;
  return (
    <section aria-labelledby="timeline-heading">
      <h2 id="timeline-heading">Shipping bill timeline</h2>
      <p>Synthetic demo data.</p>
      <form onSubmit={find} aria-label="Look up shipping bill">
        <label>
          Shipping bill hash
          <input value={lookup} onChange={(e) => setLookup(e.target.value)} required />
        </label>
        <button type="submit">Look up</button>
        {found && (
          <button type="button" onClick={() => setFound(null)}>
            Show all records
          </button>
        )}
      </form>
      {error && <p role="alert">{error}</p>}
      {shown.map((v) => (
        <Timeline key={v.record.sb_hash} view={v} api={api} />
      ))}
    </section>
  );
}

function days(v: number | null) {
  return v === null ? "Not enough data" : `${v} days`;
}

function MetricsPage({ api, tick }: { api: Api; tick: number }) {
  const [m, setM] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api.getMetrics().then(setM).catch((e) => setError(errorText(e)));
  }, [api, tick]);
  return (
    <section aria-labelledby="metrics-heading">
      <h2 id="metrics-heading">Pilot metrics</h2>
      {error && <p role="alert">{error}</p>}
      {m && (
        <>
          <p>Records in demo: {m.n_records}</p>
          <p>Median document hand-over to acknowledgement: {days(m.median_docs_handover_to_ack_days)}</p>
          <p>Median payment to mark-off: {days(m.median_payment_to_markoff_days)}</p>
          <p>Pending records: {m.pending_total}</p>
          <p>Pending records already marked off: {m.pending_with_markoff}</p>
          <p>
            Share of pending already marked off:{" "}
            {m.pending_with_markoff_share === null
              ? "Not enough data"
              : `${Math.round(m.pending_with_markoff_share * 100)}%`}
          </p>
        </>
      )}
    </section>
  );
}

function eventInWords(e: LedgerEvent) {
  return `${milestoneInWords(e.event.milestone)} recorded for ${shortHash(e.event.sb_hash)}`;
}

export function App({ api = realApi }: { api?: Api }) {
  const [view, setView] = useState<View>("bank");
  const [focus, setFocus] = useState("");
  const done = useCallback((sbHash: string) => setFocus(sbHash), []);
  const [live, setLive] = useState(false);
  const [lastEvent, setLastEvent] = useState<LedgerEvent | null>(null);
  const [refresh, setRefresh] = useState<Refresh>({ tick: 0, hashes: [] });
  const pending = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // One subscription. Bursts (seeding) collapse into at most one refresh per debounce window.
  useEffect(() => {
    const unsubscribe = api.subscribeEvents((e) => {
      setLastEvent(e);
      pending.current.add(e.event.sb_hash);
      if (timer.current) return;
      timer.current = setTimeout(() => {
        timer.current = null;
        const hashes = [...pending.current];
        pending.current.clear();
        setRefresh((r) => ({ tick: r.tick + 1, hashes }));
      }, REFRESH_DEBOUNCE_MS);
    }, setLive);
    return () => {
      unsubscribe();
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [api]);

  return (
    <main>
      <header>
        <h1>Receipt Book</h1>
        <p>
          Shared milestone record per shipping bill (pilot, synthetic data). Contracts v{CONTRACTS_VERSION}.
        </p>
      </header>

      <p className="live-status" aria-live="polite">
        {live ? "Live" : "Offline"}
        {lastEvent && ` · ${eventInWords(lastEvent)}`}
      </p>

      <nav aria-label="Main views">
        <button onClick={() => setView("bank")}>Bank desk</button>
        <button onClick={() => setView("exporters")}>Exporters' desk</button>
        <button onClick={() => setView("import")}>Customs import</button>
        <button onClick={() => setView("timeline")}>Timeline</button>
        <button onClick={() => setView("metrics")}>Metrics</button>
      </nav>

      {view === "bank" && (
        <section aria-labelledby="bank-heading">
          <h2 id="bank-heading">Bank desk</h2>
          <Desk role={OrgRole.AD_BANK} api={api} onDone={done} />
        </section>
      )}
      {view === "exporters" && (
        <section aria-labelledby="exporters-heading">
          <h2 id="exporters-heading">Exporters' desk</h2>
          <Desk role={OrgRole.EXPORTERS_BODY} api={api} onDone={done} />
        </section>
      )}
      {view === "import" && (
        <section aria-labelledby="import-heading">
          <h2 id="import-heading">Customs import</h2>
          <ImportView api={api} />
        </section>
      )}
      {view === "timeline" && <TimelinePage api={api} focus={focus} refresh={refresh} />}
      {view === "metrics" && <MetricsPage api={api} tick={refresh.tick} />}
    </main>
  );
}
