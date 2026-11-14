# Technical decisions

A record of the decisions that shape Receipt Book's design. Each entry keeps its original
number, because code comments cite them (for example `D-21` in `backend/s14/contracts.py`).
Numbers missing from the sequence were project-process decisions with no bearing on the
product; they remain in git history. Add new entries at the end with the next free number.

Format: **D-n (date). Decision.** Why. *Revisit if:* condition.

Source tags follow [PROBLEM.md](PROBLEM.md): [I] inference, [U] unknown.

---

**D-02 (16 Oct 2026). Stack: Python FastAPI backend, React/TypeScript frontend, TypeScript
chaincode.** One language beyond Python across chaincode, gateway and UI.
*Revisit if:* TypeScript chaincode stops working on Drunix (it works; see U-07).

**D-03 (16 Oct 2026). Use the real Drunix test network; in-memory fakes are test doubles only.**
The product runs on Drunix. `tests/backend/fakes.py` and the gateway's fake `Ledger` exist so
unit tests need no network; they are never a runtime mode.

**D-04 (16 Oct 2026). A thin TypeScript gateway (Fabric Gateway SDK) sits between Python and
Drunix.** Fabric Gateway client libraries exist for Go, Node and Java; no maintained Python
one is known [I]. The gateway holds no business rules.
*Revisit if:* a supported Python client appears.

**D-05 (16 Oct 2026). Endorsement policy `AND('Org1MSP.peer','Org2MSP.peer')` for every write.**
Both parties sign each milestone ([PROBLEM.md](PROBLEM.md) 6.3, 6.7). Set at deploy time in
`network/env.example.sh` (`S14_ENDORSEMENT_POLICY`); verified on the live network by
`scripts/e3_endorsement_check.sh`.

**D-06 (16 Oct 2026). Org1MSP is the AD bank, Org2MSP the exporters' body
(`DEFAULT_MSP_ROLES`).** The Drunix test network has two organisations.
*Revisit if:* a third organisation is added (roadmap; U-06).

**D-07 (16 Oct 2026). Only salted SHA-256 hashes of shipping-bill, IRM and eBRC identifiers go
on the ledger; the salt lives only in the environment (`S14_HASH_SALT`).** Exporter data
protection. The chaincode rejects anything that is not a 64-character lowercase hex hash.

**D-08 (16 Oct 2026). One contract source.** `backend/s14/contracts.py` →
`contracts/contracts.schema.json` (exported) → `contracts/contracts.ts` (TypeScript mirror) →
each package's `src/generated/` (copied), with parity tests on every side. Stops Python and
TypeScript drifting apart. See [ARCHITECTURE.md](ARCHITECTURE.md), "Contract pipeline".

**D-12 (16 Oct 2026). Spec tests define "done".** Unimplemented behaviour is a strict
`xfail(raises=NotImplementedError)` in Python or `it.fails` / `it.todo` in TypeScript; the
marker is removed in the same change that implements it. A strict xfail that starts passing
turns red on purpose.

**D-13 (16 Oct 2026). `MilestoneRequest` carries the raw reference; `TxReceipt` is the write
reply.** The browser cannot hash: the salt is server-side. The backend hashes, then forwards a
`MilestoneSubmission`.

**D-16 (18 Oct 2026). `develop` is the only long-lived branch and the default branch; `main` is
retired.** CI accepts pull requests into `develop` only (`.github/workflows/ci.yml`).

**D-17 (18 Oct 2026). Contracts 0.2.0.** (1) `occurred_on` is documented: the date the
real-world step happened, as attested by the submitter; for DOCS_ACKNOWLEDGED it is the
hand-over date. (2) The two median metrics document their basis (`ledger_time.date()` minus
`occurred_on`). (3) No free-text `note` on any ledger shape: free text could carry a raw
identifier onto the ledger (D-07). (4) `ledger_time` and `created_ledger_time` must carry a
timezone. (5) `ErrorCode.INTERNAL` is the last code, the fallback for unexpected failures.
(6) `[I]` tags on `WRITER_ROLE` and `REFERENCE_REQUIRED`.
*Revisit if:* a feature needs free text (keep it off-chain).

**D-18 (18 Oct 2026). Contracts 0.3.0: the chaincode interface is a contract.**
`CHAINCODE_ARGS` (arguments per function, all strings; `RecordMilestone` takes a
`MilestoneSubmission` as JSON), `CHAINCODE_RESULT` (result shape per function;
`GatewayResult.payload` is always parsed JSON), `CREATE_RECORD_ROLE` = AD_BANK (any other role
gets WRONG_ROLE; a missing record gets NOT_FOUND), and `ERROR_HTTP_STATUS`, shared by gateway
and backend.

**D-20 (18 Oct 2026). Contracts 1.0.0.** (1) `CHAINCODE_WRITES` = {CreateRecord,
RecordMilestone}: writes run only on `POST /submit`, reads only on `POST /evaluate`; the wrong
route gets VALIDATION. (2) `ErrorCode.OUTCOME_UNKNOWN` (504): a submit was sent with a `tx_id`
but its commit status is unknown and it may still commit. It always carries the `tx_id`, and the
backend never auto-retries it; it reads the record back instead, because a retried repeatable
Customs milestone would be recorded twice. After 1.0.0 every contract change bumps
`CONTRACTS_VERSION` (minor for additions, major for breaking changes) and gets an entry here.
*Revisit if:* Drunix shows a commit-status timeout cannot happen.

**D-21 (18 Oct 2026). Contracts 1.0.0: commit-time errors and gateway clarifications.**
`ErrorCode.MVCC_CONFLICT` (409) and `RETRYABLE_ERRORS` = {MVCC_CONFLICT}: Fabric invalidated the
transaction at commit, so nothing was recorded and a bounded retry cannot double-record [I:
follows Fabric's rule that an invalidated transaction changes no state]. The gateway maps commit
code `MVCC_READ_CONFLICT` to MVCC_CONFLICT, `ENDORSEMENT_POLICY_FAILURE` to ENDORSEMENT_FAILED,
and any other commit code to INTERNAL. A chaincode error reaches the gateway in each endorsing
peer's details as `chaincode response 500, <ErrorCode>: <message>`; the gateway reads the code
after that prefix, gives INTERNAL for an unknown code or none, and ENDORSEMENT_FAILED when peers
report different codes. `tx_id` is always null on `/evaluate` results. An `identity` with no
configured credentials gets VALIDATION. `GET /health` returns `HealthResponse`
`{status: "ok", contracts_version}` on gateway and backend. LEDGER_UNAVAILABLE is not retryable.
*Revisit if:* Drunix shows different commit behaviour.

**D-23 (20 Oct 2026). Keep YugabyteDB as the state database.** It is Drunix's default and only
wired-up option: the test network's compose files hard-code YugabyteDB and KeyDB for every peer.
Other state databases are untested (U-04).
*Revisit if:* Drunix issue #8 (non-atomic SQL and Redis writes) shows up as flaky commits.

**D-24 (20 Oct 2026). Accept the dev-only `npm audit` advisories from vitest 3.2.7 for now.**
Superseded in detail by D-32.

**D-26 (20 Oct 2026). Backend-side checks, no contract change.** A `sb_number`, `port_code` or
`reference` that is empty after stripping whitespace is rejected with VALIDATION (422) before
hashing; hashing strips whitespace, so a blank identifier would hash like an empty one. The
backend validates each gateway payload against the shape `CHAINCODE_RESULT` names and treats a
mismatch as INTERNAL. `GatewayResult.payload` stays `Any` in the contract.

**D-27 (22 Oct 2026). YugabyteDB after host sleep.** D-23 stands. YugabyteDB's tserver can die
inside its container after the host sleeps; the committing peer then panics. Run the health
check in [RUNBOOK.md](RUNBOOK.md) after any sleep, and rebuild the network (down, up, deploy)
before a live test run or a demo. Do not let the host sleep during them.
*Revisit if:* the failure happens without a host sleep, or soon after a fresh rebuild.

**D-32 (25 Oct 2026). Keep vitest 3.2.7 for now.** `npm audit` in chaincode, gateway and
frontend reports three findings, all in the dev tree under the devDependency vitest 3.2.7:
`@vitest/mocker` moderate (GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8), `tinypool` critical
(GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr) and `vitest` critical only through those two. No
runtime dependency is affected; no running service ships vitest. The mocker advisories need the
Vite dev-server mocker plugin or browser mode, which the project does not use [I]; the tinypool
ones need a prototype-pollution primitive in the test process [I]. When upgrading, use vitest
`^4.1.12` in all three packages, not 5.x (5.x needs Node ^22.12 or ^24). That 4.1.12 clears all
three findings is [I], untested.
*Revisit if:* a runtime dependency is affected, or at the next tooling upgrade.

**D-33 (25 Oct 2026). Live verification runs on a GitHub-hosted Linux runner.**
`.github/workflows/live.yml` clones npci/drunix at the pinned commit 8090e0c, builds its host
binaries, starts the test network with YugabyteDB, deploys `receiptbook` with
`AND('Org1MSP.peer','Org2MSP.peer')`, and runs the `S14_LIVE=1` suite,
`scripts/e3_endorsement_check.sh` and `scripts/demo.sh` headless with a browser smoke test. The
runner is a platform Drunix supports (Linux, Docker, Go), and every run starts from a clean
machine, so D-27's rebuild rule holds by construction. First run: Ubuntu, 2 CPUs, 7.8 GiB RAM,
Docker 28.0.4, Go 1.26.1, inside `network.sh`'s "Docker <= 28". Logs, container logs and UI
screenshots are kept as the run's `live-evidence` artifact.
*Revisit if:* a run on another host gives a different result; then investigate the difference.

**D-34 (14 Nov 2026). Contracts 1.1.0, additive only.** No 1.0.0 shape changes. Adds:
- `LedgerEvent` and `GET /events` on both gateway and backend: a `text/event-stream` of committed
  `MilestoneRecorded` chaincode events (`MILESTONE_RECORDED_EVENT`), new ones only, no replay,
  with keep-alive comments. The backend relays the gateway's stream.
- `CustomsImportRow`, `CustomsImportRequest`, `CustomsImportRowResult`, `CustomsImportResult`,
  the `ImportOutcome` enum (RECORDED, NOT_FOUND, FAILED) and `POST /customs/import`, at most
  `CUSTOMS_IMPORT_MAX_ROWS` = 200 rows per request. Each row becomes one
  CUSTOMS_STATUS_OBSERVED milestone; one failed row does not stop the rest.
- `ReferenceCheckRequest`, `ReferenceCheckResult` and `POST /records/{sb_hash}/reference-check`:
  the backend hashes a raw reference with the salt and compares it with the ledger; it stores
  nothing. For a document, the reference is the file's SHA-256 computed in the browser; the file
  itself never leaves the browser.

Why: live UI updates without polling; importing the pending/realised lists Customs publishes
mirrors how Customs works today ([PROBLEM.md](PROBLEM.md) 4.2); the fingerprint check
demonstrates tamper evidence.

*Event source (added 14 Nov 2026):* the gateway publishes the `MilestoneRecorded` event itself,
in-process, when a `RecordMilestone` it submitted is confirmed VALID by commit status (after the
other org's peer has committed it too). It does not subscribe to peer chaincode events: Drunix lite
peers keep no blocks and send no block or chaincode events ([network/README.md](../network/README.md)),
so in live run 43583206405 `GET /events` opened but never delivered an event; commit status does
work on lite peers. Consequence: only writes made through this gateway instance produce events;
writes through another gateway, or straight to the network, do not. The chaincode still emits
`MilestoneRecorded` with the same payload for any future block-event consumer.
