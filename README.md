# Receipt Book

A shared, tamper-evident, time-stamped record of each export shipping bill's milestones, kept on
**Drunix**, NPCI's open-source Hyperledger Fabric 2.5-compatible blockchain.

When an Indian exporter is paid from abroad, three records held by three different bodies must
agree: the bank's update in RBI's **EDPMS**, the exporter's self-certified **eBRC** on DGFT's
portal, and Customs' system **ICES**. When they don't, Customs can treat the payment as missing
and recover the export refund it already paid (**drawback**) with interest [P]. One Customs
notice listed 22,539 shipping bills from 2020-22, about ₹128 crore of drawback, shown as
payment-pending [P]. In December 2025 the national auditor, CAG, reported that ICES kept showing
payments as pending, or even nil, when they had been fully realised, and recommended syncing
ICES with EDPMS [P, Report 33 of 2025]. Receipt Book lets the bank and the exporter's side sign
each milestone of a shipping bill on one shared ledger, so anyone can see which record is out of
step, who signed what, and since when. The tags are explained, and the sources listed, in
[docs/PROBLEM.md](docs/PROBLEM.md); every source there is AI-read and not yet human-verified.

**Version 1.0.0** (contracts 1.1.0). Licence: Apache-2.0.

## What it does and does not do

**Does:**
- Records five milestones per shipping bill, each signed by the organisation allowed to write
  it and endorsed by both organisations.
- Enforces ownership, order and duplicate rules on the ledger, in the chaincode.
- Shows each shipping bill's timeline and a likely cause when Customs shows it as pending.
- Computes three measures of delay and of the cause split.
- Keeps only salted hashes of identifiers on the ledger.

**Does not:**
- Move money, tokens or foreign exchange.
- Connect to EDPMS, DGFT, ICEGATE, ICES or any bank system. It sits beside them; unless those
  systems read it, it is a fourth record.
- Make a bank act faster, or fix the ICES-EDPMS sync. It makes delays visible and provable.
- Use real exporter data. Demo and seed data are synthetic and labelled so.

Whether a shared ledger is needed at all, rather than a central integration, is an open
question; the honest counter-arguments are in [docs/PROBLEM.md](docs/PROBLEM.md) 6.7.

## Features

Implemented in 1.0.0 (details and test locations in [FEATURES.md](FEATURES.md)):

- Create a shipping-bill record keyed by a salted hash.
- Record the five milestones, with the rules enforced on the ledger.
- Two-organisation endorsement policy on a real Drunix network.
- Gateway between the Python backend and Drunix.
- Timeline view of one shipping bill.
- Cause assessment in five buckets.
- The three measures.
- Bank desk and exporters' desk that offer only the milestones each role may write.
- Privacy: no raw shipping-bill, IRM or eBRC numbers on the ledger.
- CI, a live end-to-end suite on Drunix, and synthetic seed data.
- Live UI updates from chaincode events over server-sent events (`GET /events`).
- Bulk import of a Customs pending/realised list from CSV (`POST /customs/import`).
- Document and reference fingerprint check (`POST /records/{sb_hash}/reference-check`): the
  browser computes a file's SHA-256 and only that is sent; the file is never uploaded.

## Architecture

```
 Browser UI (React, Vite)  :5173          desks, timeline, metrics, import, fingerprint check
   │  HTTP JSON under /api, EventSource /api/events  (Vite proxy -> :8000)
   ▼
 Backend (Python, FastAPI)  :8000         hashing with S14_HASH_SALT, cause assessment, metrics,
   │                                      Customs import, reference check, SSE relay
   │  HTTP JSON: GatewayRequest -> GatewayResult
   ▼
 Gateway (Node, TypeScript)  :8800        @hyperledger/fabric-gateway, one identity per org,
   │                                      error mapping, commit-status wait, event stream
   │  gRPC (Fabric Gateway)
   ▼
 Drunix test network, channel "receiptbook"
   │  Org1MSP = AD bank          Org2MSP = exporters' body
   │  each org: lite peer, committing peer, validation server, YugabyteDB, KeyDB; one Raft orderer
   ▼
 Chaincode "receiptbook" (TypeScript)     rules.ts + receiptBook.ts
     endorsement policy AND('Org1MSP.peer','Org2MSP.peer'): every write needs both orgs
```

The full data flow, the contract pipeline, error codes and retry rules are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Milestones

From `WRITER_ROLE`, `PRECONDITIONS`, `REFERENCE_REQUIRED` and `REPEATABLE` in
`backend/s14/contracts.py`. The role rules are design choices [I]; the two preconditions marked
[P] follow a primary source.

| Milestone | Who may write it | Needs first | Carries | Repeatable |
|---|---|---|---|---|
| `DOCS_ACKNOWLEDGED` | AD bank | nothing | reference hash (document set) | no |
| `PAYMENT_RECEIVED` | AD bank | nothing | reference hash (IRM) | no |
| `EBRC_SELF_CERTIFIED` | exporters' body | `PAYMENT_RECEIVED` (an eBRC needs an IRM, DGFT FAQ Q30 [P]) | reference hash (eBRC number) | no |
| `EDPMS_MARKED_OFF` | AD bank, and only the record's own bank | `DOCS_ACKNOWLEDGED` and `PAYMENT_RECEIVED` (mark-off follows realisation, Reg 18(1)(g) [P]) | nothing | no |
| `CUSTOMS_STATUS_OBSERVED` | exporters' body, until Customs joins as an organisation | nothing | `REALISED` or `PENDING` | yes |

Only the AD bank may create a record; that bank becomes the record's `bank_msp`. Every
milestone carries `occurred_on`, the date the real-world step happened as attested by the
submitter. The ledger adds `tx_id`, `ledger_time`, `submitter_msp` and `submitter_role`.

### Cause buckets

When the latest Customs observation is `PENDING`, the backend assigns the most likely cause, a
heuristic [I] over the four causes in [docs/PROBLEM.md](docs/PROBLEM.md) 4.3. Checked in this
order:

| Bucket | When |
|---|---|
| `CONSISTENT` | the latest Customs observation is not `PENDING`, or there is none |
| `NO_PAYMENT_RECORDED` | pending, and no `PAYMENT_RECEIVED` |
| `DOWNSTREAM_SYNC` | pending, although `EDPMS_MARKED_OFF` is recorded |
| `EXPORTER_LINKAGE_MISSING` | pending, and `DOCS_ACKNOWLEDGED` is missing |
| `BANK_NOT_MARKED_OFF` | pending, with documents and payment but no mark-off |

### Measures

From [docs/PROBLEM.md](docs/PROBLEM.md) 6.6; `GET /metrics` returns them as `MetricsSummary`. A
measure is empty when no record has the milestones it needs.

1. Median days from document hand-over to bank acknowledgement (`DOCS_ACKNOWLEDGED`'s
   `ledger_time` date minus its `occurred_on`).
2. Median days from payment to EDPMS mark-off (`EDPMS_MARKED_OFF`'s `ledger_time` date minus
   `PAYMENT_RECEIVED`'s `occurred_on`).
3. Share of pending records that already have a signed mark-off.

The day counts use `ledger_time`, which is when a record was submitted, not proof of when the
step happened (U-12).

### Privacy model

- Raw shipping-bill, IRM and eBRC numbers never go on the ledger. The backend hashes them with
  SHA-256 and a per-deployment salt from `S14_HASH_SALT`, which never goes in git (D-07).
- The shipping-bill key is the salted hash of `PORTCODE|SBNUMBER|YYYY-MM-DD` (upper-cased,
  stripped). References are hashed the same way.
- The chaincode accepts only 64-character lowercase hex hashes, and no ledger shape has a
  free-text field (D-17).
- The fingerprint check sends the backend only the file's SHA-256, computed in the browser; the
  backend hashes it with the salt, compares, and stores nothing.
- Amounts, invoices and buyer details are not stored at all.

## Repository layout

```
backend/s14/contracts.py   shared contracts: the single source of truth
backend/s14/               FastAPI app (api.py), gateway client, domain/ (hashing, assessment, metrics), seed/
contracts/                 exported JSON schema and the TypeScript mirror
chaincode/                 receiptbook chaincode (TypeScript)
gateway/                   HTTP bridge to Drunix (Node, TypeScript)
frontend/                  browser UI (React, Vite)
network/                   wrappers around the Drunix test network
tests/                     Python tests: contracts/, backend/, integration/ (live)
scripts/                   check_all.sh, demo.sh, e3_endorsement_check.sh, ui_smoke.mjs, contract tooling, git hooks
docs/                      PROBLEM, ARCHITECTURE, DECISIONS, UNKNOWNS, RUNBOOK
.github/workflows/         ci.yml (every PR), live.yml (Drunix network on a hosted runner)
```

Package READMEs: [chaincode](chaincode/README.md) · [gateway](gateway/README.md) ·
[backend](backend/README.md) · [frontend](frontend/README.md) · [network](network/README.md).

## Prerequisites

- For development and unit tests: Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node 22
  with npm, and Bash.
- For live runs and the demo, in addition: Linux (macOS on Apple Silicon also works, see
  [network/README.md](network/README.md)), Docker (Drunix's `network.sh` says <= 28), the
  standalone `docker-compose` command, Go, jq, git and curl, and a checkout of
  [npci/drunix](https://github.com/npci/drunix) with its host binaries built from source.

## Quick start

**Run the checks** (no network needed):

```bash
bash scripts/check_all.sh     # Python, chaincode, gateway and frontend, as CI runs them
```

**Run the full demo** on a machine that can run Drunix:

```bash
cp network/env.example.sh network/env.sh     # then set DRUNIX_DIR to your npci/drunix checkout
docker pull hyperledger/fabric-nodeenv:2.5 && docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5
bash scripts/demo.sh
```

`demo.sh` takes the Drunix test network down and up again, deploys the chaincode, starts the
gateway and the backend, seeds 30 synthetic records (6 per cause bucket) and serves the UI at
http://localhost:5173. Unless `S14_HASH_SALT` is set it uses a random, demo-only salt. Logs go to
`.demo-logs/`; Ctrl-C stops everything.

**Run the pieces by hand:**

```bash
# network (see network/README.md for one-time setup)
bash network/up.sh && bash network/deploy.sh

# gateway on :8800
source network/gateway-env.sh && (cd gateway && npm ci && npm run dev)

# backend on :8000
uv sync
export S14_HASH_SALT=<your own value>        # never commit it
export S14_GATEWAY_URL=http://localhost:8800
uv run uvicorn s14.api:app --app-dir backend --port 8000

# UI on :5173 (proxies /api to :8000)
(cd frontend && npm ci && npm run dev)

# optional: 30 synthetic records
PYTHONPATH=backend uv run python -m s14.seed --count 30 --backend http://localhost:8000

# stop the network
bash network/down.sh
```

Health checks and troubleshooting: [docs/RUNBOOK.md](docs/RUNBOOK.md).

## HTTP API

From `BACKEND_ROUTES` and `GATEWAY_ROUTES` in `backend/s14/contracts.py`. Bodies are JSON.
Failures return the HTTP status in `ERROR_HTTP_STATUS`, with an `ErrorBody` `{code, message}`
from the backend or a `GatewayResult` with `ok: false` from the gateway.

**Backend** (port 8000; the UI calls it under `/api`):

| Route | Request | Response |
|---|---|---|
| `GET /health` | none | `HealthResponse` `{status: "ok", contracts_version}` |
| `POST /records` | `CreateRecordRequest` `{sb_number, port_code, sb_date}` | `TxReceipt` `{sb_hash, tx_id}` |
| `POST /records/{sb_hash}/milestones` | `MilestoneRequest` `{milestone, occurred_on, acting_as, reference?, customs_status?}` | `TxReceipt` |
| `GET /records/{sb_hash}` | none | `TimelineView` (record and cause assessment) |
| `GET /records` | none | list of `TimelineView` |
| `GET /metrics` | none | `MetricsSummary` |
| `GET /events` | none | `text/event-stream`; each event's data is a `LedgerEvent` |
| `POST /customs/import` | `CustomsImportRequest` `{rows: [{sb_number, port_code, sb_date, customs_status, observed_on}]}`, 1 to 200 rows | `CustomsImportResult` (totals and per-row outcome) |
| `POST /records/{sb_hash}/reference-check` | `ReferenceCheckRequest` `{milestone, reference}` | `ReferenceCheckResult` `{sb_hash, milestone, recorded, matches, tx_id?, ledger_time?}`; NOT_FOUND if there is no record |

**Gateway** (port 8800; called by the backend only):

| Route | Request | Response |
|---|---|---|
| `GET /health` | none | `HealthResponse` |
| `POST /submit` | `GatewayRequest` `{function, args, identity}`, writes only | `GatewayResult` with `tx_id` and the parsed chaincode result |
| `POST /evaluate` | `GatewayRequest`, reads only | `GatewayResult`, `tx_id` always null |
| `GET /events` | none | `text/event-stream` of `MilestoneRecorded` events, new ones only (no replay), with keep-alive comments |

## Configuration

| Variable | Used by | Default | Meaning |
|---|---|---|---|
| `S14_HASH_SALT` | backend | none | Salt for all hashes. Required for write routes, the import and the reference check (INTERNAL if missing). Never commit it |
| `S14_GATEWAY_URL` | backend, live tests | `http://localhost:8800` | Gateway base URL |
| `S14_BACKEND_URL` | seed command | `http://localhost:8000` | Backend URL (also `--backend`) |
| `S14_GATEWAY_PORT` | gateway | `8800` | Listen port |
| `S14_CHANNEL`, `S14_CHAINCODE` | gateway, network scripts | `receiptbook` | Channel and chaincode name |
| `S14_<ROLE>_MSP_ID` | gateway | none | MSP id for `AD_BANK`, `EXPORTERS_BODY` or optional `CUSTOMS_VIEWER`; must agree with `DEFAULT_MSP_ROLES` |
| `S14_<ROLE>_PEER_ENDPOINT` | gateway | none | Peer address, e.g. `localhost:7051` |
| `S14_<ROLE>_TLS_CERT` | gateway | none | Path to the peer's TLS CA certificate |
| `S14_<ROLE>_CERT`, `S14_<ROLE>_KEY` | gateway | none | Paths to the client certificate and private key |
| `S14_<ROLE>_PEER_HOST_ALIAS` | gateway | none | Optional TLS host name override |
| `DRUNIX_DIR` | network scripts | `$HOME/drunix` in the template | Path to the npci/drunix checkout |
| `S14_ENDORSEMENT_POLICY` | `network/deploy.sh` | `AND('Org1MSP.peer','Org2MSP.peer')` in the template | Endorsement policy |
| `S14_STATE_DB` | `network/up.sh` | `yugabyte` in the template | State database |
| `S14_LIVE` | live tests | unset | `1` runs `tests/integration` against the network |
| `S14_DEMO_HEADLESS` | `scripts/demo.sh` | `0` | `1`: seed strictly, start the UI in the background and run `S14_DEMO_CHECK` |
| `S14_DEMO_CHECK` | `scripts/demo.sh` | none | Command to run against the headless demo |
| `S14_E3_WAIT` | `scripts/e3_endorsement_check.sh` | `60` | Seconds to wait for each new block |
| `S14_UI_URL`, `S14_UI_SHOTS` | `scripts/ui_smoke.mjs` | `http://localhost:5173`, `.demo-logs/ui` | UI address and screenshot folder |

`network/env.sh` (copied from `network/env.example.sh`, gitignored) sets the network variables;
`network/gateway-env.sh` sets the gateway's `S14_<ROLE>_*` variables for the test network.
`AD_BANK` and `EXPORTERS_BODY` identities are required by the gateway; `CUSTOMS_VIEWER` is
optional. The names keep the `S14_` prefix from the project's original code name.

## Testing

- **Unit suites**, no network needed: `uv run pytest` (contracts and backend; live tests are
  skipped) and `npm test` in `chaincode/`, `gateway/` and `frontend/`. `scripts/check_all.sh`
  runs them all with the TypeScript type checks, as `.github/workflows/ci.yml` does on every pull
  request. Fakes (`tests/backend/fakes.py`, `gateway/test/fakeLedger.ts`) are test doubles only.
- **Live suite**: `S14_LIVE=1 uv run pytest tests/integration` against a running gateway and
  network: all five milestones, each rejected write the chaincode raises, both orgs reading the
  same record, multi-page listing, and a check that no raw identifier reaches the ledger.
- **Endorsement check**: `bash scripts/e3_endorsement_check.sh` shows that a write endorsed by
  one organisation is invalidated and creates nothing, and that a two-organisation write
  commits.
- **UI smoke test**: `scripts/ui_smoke.mjs` drives a browser through the running demo (create a
  record, record a payment, open the timeline, check the live indicator, run a reference check,
  import a two-row Customs list, and open the metrics view).
- **Hosted live run**: `.github/workflows/live.yml` builds Drunix at a pinned commit on a
  GitHub-hosted Linux runner and runs the live suite, the endorsement check and the headless demo
  with the UI smoke test (D-33). Run it with `gh workflow run live.yml --ref <branch>`.

## Roadmap

Not built yet (details in [FEATURES.md](FEATURES.md)):

- Amounts in a Drunix private data collection (needs U-08's live test).
- A third organisation, a second bank (U-06).
- Customs as a read-only organisation.
- Per-user login mapped to organisation identities.
- A PDF evidence pack of a timeline.
- Reminders when a mark-off is overdue.
- Measuring commit latency on a test network, for internal use only.

## Known limitations

- **`ledger_time` is submission time.** It is the submitting client's clock when it signed the
  proposal, not proof of when the real-world step happened (U-12). Whether Drunix rejects a
  badly skewed client clock is untested.
- **Two-organisation test network only.** One bank and one exporters' body; the live
  `WRONG_BANK` test is skipped until a second bank exists (U-06).
- **No authentication.** The UI switches between desks and the backend signs as the role in
  `acting_as`; anyone who can reach the backend can act for either organisation.
- **Customs observations are signed by the exporters' body**, including bulk imports, until
  Customs can join as an organisation.
- **Events have no replay.** A client that reconnects misses events committed while it was away.
- **Endorsement lag.** Right after a write, the two organisations' peers can briefly disagree.
  The gateway retries mismatched endorsements and waits for the other organisation's commit, but
  a residual lag can still surface as an error; see [docs/RUNBOOK.md](docs/RUNBOOK.md).
- **Retry safety is reasoned, not proven on Drunix.** That a retried `MVCC_CONFLICT` cannot
  record twice follows Fabric's commit rule [I] (D-21).
- **Listing scale.** `ListRecords` likely returns at most about 1000 records per call on Drunix
  [I]; behaviour with many records is untested. No performance claims are made.
- **YugabyteDB after host sleep** can leave the network broken; rebuild it (D-27).
- **TypeScript chaincode runtime.** Deploying needs a retagged upstream Fabric node image; that
  it is a correct substitute is [I] (U-03).
- **Dev-only advisories.** `npm audit` reports three findings in vitest 3.2.7's dev dependency
  tree in all three Node packages; no runtime dependency is affected (D-32).
- **The cause buckets are a heuristic** [I], and the baselines for the three measures are
  unknown.

## Documentation

- [docs/PROBLEM.md](docs/PROBLEM.md): the problem, the evidence and the sources.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, data flow, contracts, errors, events.
- [docs/RUNBOOK.md](docs/RUNBOOK.md): operating the network and the services.
- [docs/DECISIONS.md](docs/DECISIONS.md): technical decisions (D-n).
- [docs/UNKNOWNS.md](docs/UNKNOWNS.md): open and answered technical questions (U-n).
- [FEATURES.md](FEATURES.md): features, roadmap and scope.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Coding agents follow [AGENTS.md](AGENTS.md).

## Licence

Apache License 2.0; see [LICENSE](LICENSE). Drunix is also Apache-2.0.
