# IMPLEMENTATION_PLAN.md: S14 Receipt Book

*Owner: p1 (lead). Version 0.1 (16 Oct 2026). Every change to this file is a PR from the
lead and gets a line in `docs/DECISIONS.md`.*

Read in this order: Part 1 (what we build), **Part 2 (who owns what, and which contract
types each person depends on)**, Part 3 (gates and tasks), Part 4 (how work joins up),
Part 5 (risks). Features and their acceptance criteria are in `FEATURES.md`; the
dependency lists are in `DEPENDENCIES.md`; the copy-paste agent prompts are in `PROMPTS.md`.

---

## Part 1. What we are building

### 1.1 The problem in one paragraph

When an Indian exporter is paid from abroad, three government records must agree: the
bank's update in RBI's **EDPMS**, the exporter's self-certified **eBRC** on DGFT's portal,
and Customs' **ICES**. When they don't, Customs can recover the export refund (**drawback**)
with interest, even when the money arrived. CAG Report 33 of 2025 found exactly that. The
full evidence is in `docs/PROBLEM.md`, the team briefing v3. We build a pilot that records
each shipping bill's milestones on a shared Drunix ledger, signed by the parties, so anyone
can see which record is out of step and since when.

### 1.2 Architecture

```
 Browser (React, P5)
   │  HTTP JSON (/api/... = contracts.BACKEND_ROUTES)
   ▼
 Backend (Python FastAPI, P4) ── hashing, cause assessment, metrics, seed data
   │  HTTP JSON (GatewayRequest -> GatewayResult = contracts.GATEWAY_ROUTES)
   ▼
 Gateway (Node/TypeScript, P3) ── @hyperledger/fabric-gateway, one identity per org
   │  gRPC (Fabric Gateway protocol)
   ▼
 Drunix test network (P3): Org1 = AD bank, Org2 = exporters' body
   │  each org: committing peer + lite peer + validation server; one Raft orderer
   ▼
 Chaincode "receiptbook" (TypeScript, P2) ── rules.ts (pure) + receiptBook.ts (state)
   endorsement policy AND('Org1MSP.peer','Org2MSP.peer')
```

**Why a separate TypeScript gateway?** The Fabric Gateway client libraries are for Go,
Node and Java. To our knowledge there is no maintained Python one [I; P3 confirms at G1,
`docs/UNKNOWNS.md` U-02]. Project Axis, another team in this hackathon, also uses a
Node/TypeScript gateway [S]. The gateway is kept deliberately thin: no business rules.

**Where each rule lives**

| Rule | Defined in | Enforced in | Checked by |
|---|---|---|---|
| Who may write which milestone | `contracts.WRITER_ROLE` | chaincode `rules.ts` | `chaincode/test/rules.spec.test.ts` + parity tests |
| Which milestone must come first | `contracts.PRECONDITIONS` | chaincode `rules.ts` | same |
| Only the record's own bank writes bank milestones | contracts docstring | chaincode `rules.ts` (WRONG_BANK) | same |
| Both orgs must endorse every write | `network/env.example.sh` (D-05) | Drunix endorsement policy | live test at G3 (P1) |
| No raw identifiers on the ledger | contracts (hash fields) | backend `domain/hashing.py` + chaincode VALIDATION | backend spec tests |
| Cause buckets | `contracts.CauseBucket` | backend `domain/assessment.py` | backend spec tests |
| Three pilot measures | `contracts.MetricsSummary` | backend `domain/metrics.py` | backend spec tests |

### 1.3 Gates (milestones for the team)

| Gate | Name | Done when | Suggested slot* |
|---|---|---|---|
| **G0** | Scaffold verified | All five reports say "yes": clean install, suites green with the exact G0 counts, contract concerns raised | Day 0 |
| **G1** | Contracts frozen + network up | Contracts v1.0.0 tagged; Drunix network runs on the host machine; stub chaincode deploys; U-02 to U-05 and U-07 answered | Day 1-3 |
| **G2** | Vertical slice | Create record + PAYMENT_RECEIVED from the UI, through backend, gateway and chaincode, on real Drunix, and read back | Day 4-7 |
| **G3** | Essential features | E1 to E10 of `FEATURES.md` pass, including the endorsement negative test | Day 8-11 |
| **G4** | Demo freeze | Seeded demo runs from a clean clone; docs updated; `develop` tagged `v1.0.0` (no `main`, D-16) | Day 12-13 |

\* Days from G0. Map them to real dates only after the organisers confirm the timeline
(`docs/UNKNOWNS.md` U-01). Project Axis's README shows a prototype build window of
10-22 Nov 2026 [S, unconfirmed for us].

---

## Part 2. Ownership and contract dependencies (who owns what, what each person depends on)

### 2.1 People and slices

| Id | Slice | Branch prefix | Typical agent use |
|---|---|---|---|
| **p1** | **Lead + integrator**: contracts, CI, repo rules, integration tests, demo script, docs, all merges | `p1/` (+ only p1 touches `develop`, `integration/*`, tags; `main` is retired, D-16) | Review, contract diffs, integration debugging |
| **p2** | Chaincode on Drunix (TypeScript) | `p2/` | Rules + state + events |
| **p3** | Gateway (TypeScript) + Drunix network ops | `p3/` | Network scripts, Fabric Gateway client, error mapping |
| **p4** | Python backend (FastAPI): hashing, gateway client, routes, assessment, metrics, seed data | `p4/` | Domain logic + API |
| **p5** | Frontend (React/TS): desks, timeline, metrics | `p5/` | UI + API client |

The lead is p1 by default (`scripts/team.conf`, `LEAD_ID=p1`). If your lead is someone
else, swap the names in this table only. The rules key off `LEAD_ID`, not the number.

### 2.2 File ownership

Authoritative list: `.github/CODEOWNERS`. In short:

| Owner | Paths |
|---|---|
| p1 | `backend/s14/contracts.py`, `contracts/`, `chaincode/src/generated/`, `gateway/src/generated/`, `frontend/src/generated/`, `tests/factories.py`, `tests/contracts/`, `tests/integration/`, `scripts/`, `.github/`, `docs/` (except others' logs), root `*.md`, `pyproject.toml`/`uv.lock` (shared with p4) |
| p2 | `chaincode/src/rules.ts`, `chaincode/src/receiptBook.ts`, `chaincode/src/index.ts`, `chaincode/test/`, `chaincode/package*.json` |
| p3 | `gateway/src/{config,server,main}.ts`, `gateway/src/ledger/`, `gateway/test/`, `gateway/package*.json`, `network/` |
| p4 | `backend/s14/api.py`, `backend/s14/gateway_client.py`, `backend/s14/domain/`, `backend/s14/seed/`, `tests/backend/` |
| p5 | `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/views/`, `frontend/src/components/`, `frontend/test/`, `frontend/package*.json`, `frontend/vite.config.ts`, `frontend/index.html` |
| each | their own `docs/logs/<id>.md` |

New files go under a folder you own. Need a file somewhere else? Ask the lead first and log it.

### 2.3 Contract types each person depends on

"Input" = types you receive and must accept. "Output" = types you produce and must match exactly.
**At G0, review these types closely and raise concerns before the G1 freeze.**

| Id | Input (consumes) | Output (produces) | Rules / constants used |
|---|---|---|---|
| **p1** | everything (owns it) | `contracts.py`, `contracts.schema.json`, `contracts.ts` | all |
| **p2** | `MilestoneSubmission` (JSON arg of `RecordMilestone`), `sb_hash` string (`CreateRecord`, `GetRecord`) | `ShippingBillRecord`, `MilestoneEvent` (JSON results); errors as `"<ErrorCode>: message"` | `ChaincodeFunction`, `WRITER_ROLE`, `PRECONDITIONS`, `REPEATABLE`, `REFERENCE_REQUIRED`, `DEFAULT_MSP_ROLES`, `HASH_PATTERN`, `ErrorCode`, `CREATE_RECORD_ROLE`, `CHAINCODE_ARGS`, `CHAINCODE_RESULT` |
| **p3** | `GatewayRequest` (from p4); chaincode results and error strings (from p2) | `GatewayResult`, `ErrorBody` | `GATEWAY_ROUTES`, `ChaincodeFunction`, `OrgRole` (identity choice), `DEFAULT_MSP_ROLES`, `ErrorCode` mapping, `CHAINCODE_ARGS`, `CHAINCODE_RESULT` (payload is parsed JSON), `ERROR_HTTP_STATUS` |
| **p4** | `CreateRecordRequest`, `MilestoneRequest` (from p5); `GatewayResult` with `ShippingBillRecord` payloads (from p3) | `TxReceipt`, `TimelineView`, `CauseAssessment`, `MetricsSummary`, `ErrorBody`; `MilestoneSubmission` + `GatewayRequest` (to p3) | `BACKEND_ROUTES`, `CauseBucket`, `REFERENCE_REQUIRED`, `WRITER_ROLE` (to pick identity), `HASH_PATTERN`, `CHAINCODE_ARGS`, `ERROR_HTTP_STATUS` |
| **p5** | `TxReceipt`, `TimelineView`, `CauseAssessment`, `MetricsSummary`, `ErrorBody` (from p4) | `CreateRecordRequest`, `MilestoneRequest` (to p4) | `BACKEND_ROUTES`, `Milestone`, `WRITER_ROLE` (which buttons each desk shows), `CustomsStatus`, `CauseBucket`, `ERROR_HTTP_STATUS` |

### 2.4 Stand-ins while you wait for someone else

Nobody waits idle. Until the real thing lands on `develop`, use these:

| You are | You need | Stand-in until then | Real thing arrives |
|---|---|---|---|
| p2 | a network to deploy on | unit tests on `rules.ts` (no network) | p3, G1 |
| p3 | our chaincode | deploy Drunix's own `asset-transfer-basic` sample to prove connectivity | p2, G2 |
| p4 | the gateway | `tests/backend/fakes.py` `FakeGateway` | p3, G2 |
| p5 | the backend | fixtures built from contract shapes in `frontend/test/` | p4, G2 |
| p1 | all of the above | `tests/integration` stays skipped until G2 | everyone, G2 |

---

## Part 3. Gates and tasks (IDs are what you put in branch names, PRs and logs)

Task ID format: `P<n>-G<gate>-T<k>`. A task is done when its acceptance test passes on
your branch and the lead has merged it.

### G0: Scaffold verified (everyone, read-only, Day 0)

| ID | Owner | Task | Accept when |
|---|---|---|---|
| P1-G0-T1 | p1 | Create the GitHub repo from this folder (`REPO_SETUP.md`), set branch protection and CODEOWNERS usernames | `develop` exists and is the default branch; a member's test push to `develop` is rejected |
| P*-G0-T2 | all | Run the G0 kickoff prompt (`PROMPTS.md`) | report committed to own log via PR `p<n>/g0-report` |
| P1-G0-T3 | p1 | Collect the five reports; list contract concerns | `INTEGRATION_LOG.md` G0 entry; G0 declared or not |

### G1: Contracts frozen + network up (Day 1-3)

| ID | Owner | Task | Accept when |
|---|---|---|---|
| P1-G1-T1 | p1 | Apply G0 contract concerns, bump to `1.0.0`, regenerate schema + TS copies | all parity tests green; tag `contracts-v1.0.0` |
| P1-G1-T2 | p1 | Confirm hackathon dates, challenge code, judging criteria, prototype requirement (U-01) | `docs/UNKNOWNS.md` U-01 closed with source |
| P2-G1-T1 | p2 | Implement `rules.checkMilestone` | all 9 `rules.spec` cases changed from `it.fails` to `it` and green |
| P2-G1-T2 | p2 | Confirm TypeScript chaincode runs on Drunix (U-07): deploy the stub | stub deploys; finding logged with evidence |
| P3-G1-T1 | p3 | Bring up the Drunix test network on the host machine (`network/up.sh`) | `network.sh` output logged; peers and orderer containers running |
| P3-G1-T2 | p3 | Answer U-02 to U-05 (gateway peer, `-ccep`/`-ccl typescript`, state DB, channel name) | each closed in `docs/UNKNOWNS.md` with evidence |
| P3-G1-T3 | p3 | Implement `config.loadConfig` | 2 `config.spec` cases changed to `it` and green |
| P4-G1-T1 | p4 | Seed-data generator skeleton `backend/s14/seed/` (synthetic, labelled) | unit test for generator shape |
| P5-G1-T1 | p5 | UI shell: four views with fixture data (bank desk, exporters' desk, timeline, metrics) | render tests for each view |

### G2: Vertical slice on real Drunix (Day 4-7)

| ID | Owner | Task | Accept when |
|---|---|---|---|
| P2-G2-T1 | p2 | `CreateRecord`, `RecordMilestone`, `GetRecord` using `rules.ts`; emit `MilestoneRecorded` event | chaincode unit tests with a mocked `ctx.stub`; deployed via `network/deploy.sh` |
| P3-G2-T1 | p3 | `POST /submit`, `POST /evaluate` with Fabric Gateway; error mapping to `ErrorCode` | the 5 `it.todo` in `server.test.ts` become real tests with a fake `Ledger`; one manual live call logged |
| P4-G2-T1 | p4 | `domain/hashing.py` | 5 hashing specs un-marked and green |
| P4-G2-T2 | p4 | `HttpGateway` + routes `create_record`, `record_milestone`, `get_timeline` | API tests with `FakeGateway` |
| P5-G2-T1 | p5 | `api.ts` (`createRecord`, `recordMilestone`, `getTimeline`) + bank desk + timeline view | api todos become tests (fetch mocked) |
| P1-G2-T1 | p1 | Live round-trip test (`tests/integration`) | `S14_LIVE=1` test green on host machine; output logged |

### G3: Essential features (Day 8-11)

| ID | Owner | Task | Accept when |
|---|---|---|---|
| P2-G3-T1 | p2 | `ListRecords`; all five milestones via `RecordMilestone` | unit tests per milestone, incl. WRONG_BANK |
| P3-G3-T1 | p3 | Endorsement negative test: a write endorsed by one org only must fail | evidence (command + output) in `docs/logs/p3.md` |
| P4-G3-T1 | p4 | `domain/assessment.py` | 7 assessment specs green |
| P4-G3-T2 | p4 | `domain/metrics.py` + `/metrics` + `/records` list | 4 metrics specs green; route tests |
| P4-G3-T3 | p4 | Seed command loading ~30 synthetic shipping bills across all five cause buckets via the gateway | command documented; counts logged |
| P5-G3-T1 | p5 | Exporters' desk; cause bucket in plain words; metrics view; desks show only allowed milestones | view todos become tests |
| P1-G3-T1 | p1 | Live tests for all five milestones and one rejected write per ErrorCode the chaincode raises | live suite green, logged |

### G4: Demo freeze (Day 12-13)

| ID | Owner | Task | Accept when |
|---|---|---|---|
| P1-G4-T1 | p1 | `scripts/demo.sh`: clean network → deploy → seed → open UI | runs from a fresh clone on the host machine |
| P1-G4-T2 | p1 | Tag the verified `develop` SHA `v1.0.0` and freeze (`docs/GIT_WORKFLOW.md`, gate close) | tag exists on `develop`; `INTEGRATION_LOG.md` closing entry |
| P2..P5-G4-T1 | each | Fix-only work on demo blockers; README section for own slice | lead's go/no-go |

Non-essential features (N1-N10) start only after G3 is declared, in the order in `FEATURES.md`.

---

## Part 4. How work joins up (integration protocol)

### 4.1 The daily loop

1. **Start:** run your mid-execution prompt (`PROMPTS.md`). It rebases your branch on
   `origin/develop` and re-checks contracts.
2. **Work** only in your files; keep spec tests as the target.
3. **End:** append your log entry, push your branch, open or update your PR to `develop`.
4. **Lead merge window** (once or twice a day): the lead merges in the order of 4.3, runs
   `bash scripts/check_all.sh` on `develop` after **each** merge, and records the result in
   `docs/logs/INTEGRATION_LOG.md`.

### 4.2 Contract change protocol (after the G1 freeze)

1. The requester writes `CCR-<id>-<n>` in their log: what, why, which owners are affected.
2. The lead decides and records it in `docs/DECISIONS.md`.
3. On approval, the lead alone edits `contracts.py` + `contracts.ts`, bumps
   `CONTRACTS_VERSION` (minor for additions, major for breaking), runs `export_schema.py`
   and `sync_ts_contracts.sh`, merges as `p1/ccr-<n>`, and announces it.
4. Every affected owner rebases; their parity tests tell them what changed.

### 4.3 Merge order (avoids most conflicts)

Within a merge window: **p1 (contracts/scripts) → p2 → p3 → p4 → p5 → p1 (integration
tests)**. This follows the dependency chain: chaincode → gateway → backend → UI.
Rule: if a PR is red after rebasing on the latest `develop`, it waits for the next window.
The lead never "fixes it while merging".

### 4.4 When something conflicts or doesn't match

| Situation | What the owner does | What the lead does |
|---|---|---|
| Rebase conflict in **your own** file | resolve, rerun suites, log `CNF-<id>-<n>` | nothing |
| Rebase conflict in **someone else's** file | `git rebase --abort`; log `CNF-…`; tell lead | finds who touched what; the file's owner fixes |
| Your code needs something not yet on `develop` | use the stand-in (2.4); log `DEP-<id>-<n>` | tracks it in `INTEGRATION_LOG.md` |
| A package/library is missing | add it only inside your own package; log `DEP-…` with version | approves lockfile change in PR |
| `develop` is red after a merge | stop merging; log | reverts the last merge (`git revert -m 1`), logs, notifies owner |
| Something on `develop` doesn't match the contract | log `ISS-<id>-<n>` with test output | assigns it to the owner of the mismatching side |

---

## Part 5. Risks and how we watch them

| Risk | Signal | Response |
|---|---|---|
| Drunix Gateway API not served by the peer we expect (U-02) | gateway cannot connect at G1 | fallback: gateway shells out to `peer chaincode invoke/query` in the test network's environment; logged as a decision |
| TypeScript chaincode not supported in practice (U-07) | deploy fails at P2-G1-T2 | fallback order: compiled JavaScript (same code), then Go; the team decides, recorded in DECISIONS |
| Only one machine can run the network | G1 | that machine is the "host machine"; others develop against fakes; live tests run there |
| YugabyteDB + issue #8 | flaky commits | try another state DB (U-04); log every failure with logs |
| Contract churn after G1 | parity tests red on many branches | CCR protocol only; lead batches changes |
| Lead bottleneck | PRs waiting more than 1 day | two merge windows a day; small PRs (< 400 lines) |
| Agents ignoring rules | PR touches foreign files | CODEOWNERS review + CI branch check + pre-push hook; reject and log |
