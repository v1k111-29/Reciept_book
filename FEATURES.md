# Features

What Receipt Book 1.0.0 does (contracts 1.1.0), what is planned, and what is out of scope. The
background is in [docs/PROBLEM.md](docs/PROBLEM.md).

## Implemented in 1.0.0

| ID | Feature | Where the tests live |
|---|---|---|
| **E1** | Create a shipping-bill record keyed by a salted hash of port code, shipping-bill number and date | `tests/backend/test_hashing_spec.py`, `tests/backend/test_api.py`, `chaincode/test/receiptBook.test.ts`, `frontend/test/App.test.tsx`, live suite |
| **E2** | Record the five milestones, with ownership, order and duplicate rules enforced **on the ledger** by the chaincode | `chaincode/test/rules.spec.test.ts`, `chaincode/test/receiptBook.test.ts`, live suite (all five milestones and each rejected write) |
| **E3** | Two-organisation endorsement policy on the Drunix network: a write endorsed by one organisation alone is rejected | `scripts/e3_endorsement_check.sh` (run in `.github/workflows/live.yml`) |
| **E4** | Gateway between the Python backend and Drunix, with error mapping and commit-status handling | `gateway/test/` (server, ledger and config tests), live suite |
| **E5** | Timeline of one shipping bill: milestones in ledger order, who signed, when it was recorded | `tests/backend/test_api.py`, `frontend/test/App.test.tsx` |
| **E6** | Cause assessment of a Customs "pending" in five buckets (one consistent, four causes) | `tests/backend/test_assessment_spec.py` |
| **E7** | The three measures: hand-over to acknowledgement, payment to mark-off, share of pending records that already had a mark-off | `tests/backend/test_metrics_spec.py`, `frontend/test/App.test.tsx` |
| **E8** | Bank desk and exporters' desk offer only the milestones their role may write (`WRITER_ROLE`) | `frontend/test/App.test.tsx` |
| **E9** | Privacy: no raw shipping-bill, IRM or eBRC numbers on the ledger; the salt only in the environment | `tests/backend/test_hashing_spec.py`, chaincode VALIDATION tests, live test `test_no_raw_identifiers_on_the_ledger` |
| **E10** | CI on every pull request, a live end-to-end suite on a real Drunix network, and synthetic seed data labelled as synthetic | `.github/workflows/ci.yml`, `.github/workflows/live.yml`, `tests/integration/`, `tests/backend/test_seed.py`, `tests/backend/test_seed_demo.py` |
| **N4** Live updates | The UI updates from committed `MilestoneRecorded` chaincode events, streamed as server-sent events on `GET /events` (gateway and backend) | `gateway/test/ledger.events.test.ts`, `gateway/test/server.events.test.ts`, `tests/backend/test_events.py`, `frontend/test/features.test.tsx` |
| **N5** Customs import | Bulk import of a Customs pending/realised list from CSV (`POST /customs/import`, at most 200 rows): each row becomes a CUSTOMS_STATUS_OBSERVED milestone; per-row outcome RECORDED, NOT_FOUND or FAILED | `tests/backend/test_customs_import.py`, `frontend/test/features.test.tsx` |
| **N6** Fingerprint check | Check a document or reference against the hash on the ledger (`POST /records/{sb_hash}/reference-check`). For a file, the browser computes its SHA-256; the file is never uploaded | `tests/backend/test_reference_check.py`, `frontend/test/features.test.tsx` |

N4 to N6 follow contracts 1.1.0 (docs/DECISIONS.md D-34). The E and N identifiers are stable;
code comments cite them.

## Roadmap (not built)

| ID | Feature | Open dependency |
|---|---|---|
| **N1** | Amounts in a Drunix private data collection, shared only with the bank and the exporters' body | U-08: private data on Drunix needs a live test ([docs/UNKNOWNS.md](docs/UNKNOWNS.md)) |
| **N2** | A third organisation (a second bank), so competing banks share one ledger; enables the live WRONG_BANK test | U-06: no add-org script in the Drunix test network |
| **N3** | Customs as a read-only organisation (`CUSTOMS_VIEWER`) | Same mechanism as the third organisation (U-06) |
| **N7** | Per-user login mapped to organisation identities | The UI currently switches desks instead |
| **N8** | Export a shipping bill's timeline as a PDF evidence pack | None |
| **N9** | Reminder when a mark-off is overdue | None; a commercial tool already does this off-ledger ([docs/PROBLEM.md](docs/PROBLEM.md) 5.2) |
| **N10** | Measure commit latency on a test network, for internal use only | Drunix publishes no benchmarks; no performance claims will be made from it |

## Out of scope

- Moving money, tokens, foreign exchange or payouts.
- Connecting to real EDPMS, DGFT, ICEGATE or bank systems.
- Real exporter data. Demo and seed data are synthetic and labelled so.
