# FEATURES.md: essential and non-essential features

*Owner: p1. "Essential" means the pilot is not demo-able without it; all ten must pass by
G3. "Non-essential" work starts only after G3 is declared, in the order listed, and only
if the lead says so.*

## Essential (E1-E10): must pass by G3

| ID | Feature | Owner(s) | Gate | Acceptance (test or evidence) | Why it's essential |
|---|---|---|---|---|---|
| **E1** | Create a shipping-bill record keyed by a salted hash | p4 (hash, route), p2 (`CreateRecord`), p3 (submit), p5 (form) | G2 | hashing specs + `CreateRecord` unit test + live round-trip | No record, no pilot |
| **E2** | Record the five milestones with ownership, order and duplicate rules enforced **on the ledger** | p2 | G1 rules, G3 all five | 9 `rules.spec` cases + per-milestone unit tests + live tests | The ledger is the referee; rules can't live only in the UI |
| **E3** | Two-org endorsement policy on the real Drunix network | p3 (+p2) | G3 | negative test: single-org endorsement rejected (evidence in log) | It is the main thing Drunix does that a database doesn't (`docs/PROBLEM.md` 6.7) |
| **E4** | Gateway bridge: backend ↔ Drunix | p3 | G2 | `server.test.ts` routes + live call | Python can't talk to Drunix directly (D-04) |
| **E5** | Timeline view of one shipping bill (milestones in ledger order, who signed, when) | p4 (`get_timeline`), p5 (view) | G2 | API + view tests | The core user story: "which step is missing, since when" |
| **E6** | Cause assessment in five buckets (CONSISTENT + four causes) | p4 | G3 | 7 assessment specs | Measures the cause split, the biggest open question (`docs/PROBLEM.md` 4.3) |
| **E7** | The three pilot measures (docs hand-over → ack; payment → mark-off; share of pending that already had a mark-off) | p4, p5 (view) | G3 | 4 metrics specs + view test | The pilot's first deliverable is measurement (PROBLEM 6.6) |
| **E8** | Desks: bank desk and exporters' desk only offer the milestones their role may write | p5 | G3 | view tests against `WRITER_ROLE` | Prevents demo errors; shows the role rules |
| **E9** | Privacy: no raw shipping-bill, IRM or eBRC numbers on the ledger; salt only in env | p4, p2 (VALIDATION) | G2 | hashing specs + chaincode VALIDATION tests + a grep check in the live test | Exporter data protection; our honesty rule |
| **E10** | CI green + live end-to-end test + synthetic seed data labelled as synthetic | p1 (CI, live), p4 (seed) | G3 | CI badge green; `S14_LIVE=1` suite green; seed command logged | Proves it works on real Drunix, not just in unit tests |

## Non-essential (N1-N10): only after G3, in this order

| ID | Feature | Owner(s) | Depends on | Note |
|---|---|---|---|---|
| **N1** | Amounts in a Drunix **private data collection** (bank + exporters' body only) | p2, p3 | E2, E3; U-08 (private data on Drunix) | Strengthens the "why Drunix" answer; the sample network has a private-data example |
| **N2** | Third org (Bank B) to show competing banks on one ledger | p3, p2 | U-06 (can the test network add an org?) | Makes the multi-bank story real |
| **N3** | Customs as a read-only org (`CUSTOMS_VIEWER`) | p3, p2, p5 | N2's mechanism | Matches the "read-only later" design |
| **N4** | Live UI updates from chaincode events (`MilestoneRecorded`) | p3, p5 | E4 | Nice for demo |
| **N5** | Bulk import of a Customs pending list (CSV) → `CUSTOMS_STATUS_OBSERVED` events | p4, p5 | E6 | Mirrors the Customs drives (public notices with lists) |
| **N6** | Document fingerprint check: upload a file, compare its hash with the on-ledger `reference_hash` | p4, p5 | E1 | Demonstrates tamper evidence |
| **N7** | Per-user login mapped to org identities | p4, p3 | E4 | Demo can run with desk switching instead |
| **N8** | Export a shipping bill's timeline as a PDF "evidence pack" | p5 | E5 | For a Customs officer |
| **N9** | Reminder when a mark-off is overdue (like Niryatbox's email nudge) | p4 | E7 | A commercial tool already does this off-ledger [S] |
| **N10** | Measurement of commit latency on our network (internal only, no public claims) | p3 | E3 | Drunix publishes no benchmarks; never claim a number in the pitch |

## Out of scope (do not build)

- Moving money, tokens, FX, payouts: that's other teams' problem space (`docs/PROBLEM.md` 5.4).
- Connecting to real EDPMS, DGFT, ICEGATE or bank systems: no access, and not allowed.
- Any real exporter data. Synthetic only.
