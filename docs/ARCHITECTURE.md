# Architecture

How Receipt Book is put together, how a request travels through it, and how the shared
contracts keep the parts in step. The problem it addresses is in [PROBLEM.md](PROBLEM.md);
design decisions are in [DECISIONS.md](DECISIONS.md) (cited as D-n).

## Components

```
 Browser UI (React, Vite)                frontend/
   │  HTTP JSON under /api (Vite proxy strips the prefix)   BACKEND_ROUTES
   │  + EventSource on /api/events
   ▼
 Backend (Python, FastAPI) :8000          backend/s14/
   │  hashing (salt from S14_HASH_SALT), cause assessment, metrics,
   │  Customs import, reference check, SSE relay
   │  HTTP JSON: GatewayRequest -> GatewayResult             GATEWAY_ROUTES
   ▼
 Gateway (Node, TypeScript) :8800         gateway/
   │  @hyperledger/fabric-gateway, one gRPC connection and identity per org,
   │  error mapping, commit-status wait, chaincode event subscription
   │  gRPC (Fabric Gateway protocol)
   ▼
 Drunix test network                      network/ (wraps npci/drunix test-network)
   │  Org1MSP = AD bank, Org2MSP = exporters' body
   │  per org: lite peer, committing peer, validation server, YugabyteDB, KeyDB
   │  one Raft orderer; channel "receiptbook"
   ▼
 Chaincode "receiptbook" (TypeScript)     chaincode/
     rules.ts (pure rules) + receiptBook.ts (state, events)
     endorsement policy AND('Org1MSP.peer','Org2MSP.peer')
```

| Component | Owns | Never does |
|---|---|---|
| Frontend | Desks, timeline, metrics, Customs import, fingerprint check; computes a file's SHA-256 in the browser | Talk to the gateway or Drunix; hash identifiers (it has no salt) |
| Backend | Hashing raw identifiers with the salt; picking the signing identity; bounded MVCC retry; OUTCOME_UNKNOWN read-back; cause assessment; metrics; SSE relay | Talk to Drunix directly; enforce milestone rules (the chaincode does) |
| Gateway | Request-shape validation; signing as the requested org; submit vs evaluate; commit-status wait; error mapping; event stream | Business rules; hashing; storage; retrying anything except an endorsement mismatch |
| Chaincode | Who may write which milestone, order, duplicates, hash format; stamping `tx_id`, `ledger_time`, submitter | Hashing; reading the peer's clock; choosing endorsers |
| Network | Running Drunix; the endorsement policy, set at deploy time (D-05) | Anything in this repository's code |

### Where each rule lives

| Rule | Defined in | Enforced in | Checked by |
|---|---|---|---|
| Who may write which milestone | `contracts.WRITER_ROLE` | `chaincode/src/rules.ts` | `chaincode/test/rules.spec.test.ts`, parity tests |
| Which milestone must come first | `contracts.PRECONDITIONS` | `chaincode/src/rules.ts` | same |
| Only the record's own bank writes bank milestones | `contracts.py` docstrings | `chaincode/src/rules.ts` (WRONG_BANK) | chaincode unit tests |
| Both orgs must endorse every write | `network/env.example.sh` (D-05) | Drunix endorsement policy | `scripts/e3_endorsement_check.sh` |
| No raw identifiers on the ledger | hash fields in `contracts.py` (D-07) | `backend/s14/domain/hashing.py`, chaincode VALIDATION | backend hashing specs, live test `test_no_raw_identifiers_on_the_ledger` |
| Cause buckets | `contracts.CauseBucket` | `backend/s14/domain/assessment.py` | `tests/backend/test_assessment_spec.py` |
| Three measures | `contracts.MetricsSummary` | `backend/s14/domain/metrics.py` | `tests/backend/test_metrics_spec.py` |

## Data flow: a write

Recording PAYMENT_RECEIVED from the bank desk:

1. The browser posts a `MilestoneRequest` to `/api/records/{sb_hash}/milestones` with the raw
   IRM reference and `acting_as: AD_BANK`. The Vite proxy forwards it to the backend as
   `POST /records/{sb_hash}/milestones`.
2. The backend validates the body (VALIDATION, 422, on failure; blank identifiers too, D-26),
   hashes the reference with `S14_HASH_SALT` (INTERNAL, 500, if the salt is missing), and builds
   a `MilestoneSubmission`. The raw reference is never stored or logged.
3. The backend posts a `GatewayRequest` `{function: "RecordMilestone", args: [<submission
   JSON>], identity: "AD_BANK"}` to the gateway's `POST /submit`.
4. The gateway checks the shape (`CHAINCODE_ARGS`, `CHAINCODE_WRITES`), signs as Org1MSP and
   sends the proposal through Org1's peer. Endorsements from both orgs are needed to satisfy
   the policy. The chaincode on each endorsing peer runs the same checks and must build a
   byte-identical result, so it never reads the peer's clock: `ledger_time` comes from the
   proposal timestamp (U-12).
5. The gateway submits to the orderer and waits for the commit status on the submitting org's
   peer. After a VALID commit it also waits, within the remaining time budget, until the other
   org's peer has committed the transaction, so the next write, endorsed by both orgs, sees it
   on both. If that second wait fails, it logs a warning and still returns success.
6. The gateway returns a `GatewayResult` with `tx_id` and the `MilestoneEvent` as parsed JSON.
   The backend checks the payload against `CHAINCODE_RESULT` (INTERNAL on mismatch, D-26) and
   returns a `TxReceipt` `{sb_hash, tx_id}`.
7. On commit the chaincode's `MilestoneRecorded` event reaches every open `/events` stream
   (see "Events").

Creating a record is the same path with `CreateRecord` and `[sb_hash]`, always signed as the
AD bank (`CREATE_RECORD_ROLE`); that org becomes the record's `bank_msp`.

## Data flow: a read

Opening a timeline:

1. The browser calls `GET /api/records/{sb_hash}`.
2. The backend posts `{function: "GetRecord", args: [sb_hash], identity: "AD_BANK"}` to the
   gateway's `POST /evaluate`. Evaluate queries a peer and orders nothing; `tx_id` is always
   null.
3. The backend validates the `ShippingBillRecord`, runs the cause assessment and returns a
   `TimelineView` (record plus assessment). `GET /records` does the same with `ListRecords`;
   `GET /metrics` computes `MetricsSummary` over all records.

`ListRecords` is a paged range query in the chaincode. Drunix's SQL state DB caps an unpaged
range scan, so the chaincode pages through results and returns an INTERNAL error rather than a
partial list if paging misbehaves; see [`chaincode/README.md`](../chaincode/README.md).

## Contract pipeline

All interfaces between the parts are defined once (D-08):

```
backend/s14/contracts.py            source of truth: enums, models, rules, error codes, routes
   │  uv run python scripts/export_schema.py
   ▼
contracts/contracts.schema.json     exported values (enums, rule tables, routes, statuses)
contracts/contracts.ts              hand-written TypeScript mirror; contracts/parity.ts compares it with the JSON
   │  bash scripts/sync_ts_contracts.sh
   ▼
chaincode/src/generated/  gateway/src/generated/  frontend/src/generated/   copies, never edited by hand
```

Tests that go red on drift:

- `tests/contracts/test_schema_parity.py`: the committed JSON matches `contracts.py`.
- `tests/contracts/test_ts_copies_in_sync.py`: every `src/generated/` copy matches `contracts/`.
- `chaincode/test/parity.test.ts`, `gateway/test/parity.test.ts`,
  `frontend/test/parity.test.ts`: the TypeScript mirror matches the JSON.
- `tests/contracts/test_contracts.py`: internal consistency of the rule tables.

### How to change a contract

1. Edit `backend/s14/contracts.py`. Bump `CONTRACTS_VERSION`: minor for additions, major for
   anything that changes or removes an existing shape (D-20).
2. Run `uv run python scripts/export_schema.py`.
3. Mirror the change in `contracts/contracts.ts` (including `CONTRACTS_VERSION`), and in
   `contracts/parity.ts` if a new table is exported.
4. Run `bash scripts/sync_ts_contracts.sh`.
5. Add an entry to [DECISIONS.md](DECISIONS.md) with the reason.
6. Run `bash scripts/check_all.sh`. Never fix a parity failure by editing a test or a generated
   copy.

## Errors and retries

Failed responses carry the HTTP status from `ERROR_HTTP_STATUS`. The gateway's body is a
`GatewayResult` with `ok: false`; the backend's body is an `ErrorBody` `{code, message}`.

| Code | HTTP | Raised by | Meaning |
|---|---|---|---|
| VALIDATION | 422 | backend, gateway, chaincode | Malformed input, wrong route for a function, or an identity with no credentials |
| NOT_FOUND | 404 | chaincode | No record for this `sb_hash` |
| ALREADY_EXISTS | 409 | chaincode | CreateRecord on an existing `sb_hash` |
| WRONG_ROLE | 403 | chaincode | The submitter's role may not write this milestone |
| WRONG_BANK | 403 | chaincode | A bank other than the record's bank tried to write |
| PRECONDITION_FAILED | 409 | chaincode | A required earlier milestone is missing |
| DUPLICATE_MILESTONE | 409 | chaincode | A non-repeatable milestone already exists |
| ENDORSEMENT_FAILED | 502 | gateway | Peers reported different codes, or the commit was `ENDORSEMENT_POLICY_FAILURE` |
| MVCC_CONFLICT | 409 | gateway | Invalidated at commit (`MVCC_READ_CONFLICT`); nothing recorded; retryable |
| LEDGER_UNAVAILABLE | 503 | gateway, backend | Peer, orderer or gateway not reached, or no event source |
| OUTCOME_UNKNOWN | 504 | gateway | Sent with a `tx_id`, commit status unknown; it may still commit |
| INTERNAL | 500 | any | Unexpected failure, unknown chaincode code, invalid payload, missing salt |

The chaincode reports its errors as `"<ErrorCode>: <text>"`; peers pass them on as
`chaincode response 500, <ErrorCode>: <text>`, and the gateway reads the code from there (D-21).

**Retry rules.**

- **MVCC_CONFLICT, in the backend.** The only code in `RETRYABLE_ERRORS`. Write routes retry a
  conflicting submit at most 3 times in total (`MVCC_MAX_ATTEMPTS`), 0.2 s apart. Safe because
  an invalidated transaction changes no state [I] (D-21). If all attempts conflict, the client
  gets 409.
- **OUTCOME_UNKNOWN, in the backend: never retried.** The backend reads the record back. A
  create succeeds if the record now exists (unless an earlier attempt conflicted, when a
  concurrent create may have won); a milestone succeeds only if the record holds an event with
  the same `tx_id` and milestone. Otherwise the client gets 504 and should check the record
  before trying again (D-20).
- **Endorsement mismatch, in the gateway.** When the two orgs' peers read different versions of
  a key (one has committed the previous write, the other not yet), the peer gateway answers
  "ProposalResponsePayloads do not match" and nothing is ordered. The gateway sends a new
  proposal with a new transaction id, up to 3 attempts, 300 ms apart, within its time budget
  (`MISMATCH_RETRY` in `gateway/src/ledger/fabric.ts`). Nothing else is retried in the gateway.
- **Waiting for the other org's commit, in the gateway.** Described in step 5 of the write
  flow. It reduces, but does not remove, the lag that causes mismatches.

The gateway's gRPC deadlines (`DEADLINES_MS` in `gateway/src/ledger/fabric.ts`) are chosen
budgets, not measurements, set to stay under the backend client's 10 s timeout so a slow commit
comes back as OUTCOME_UNKNOWN rather than LEDGER_UNAVAILABLE. See
[`gateway/README.md`](../gateway/README.md) for the exact values.

## Events

```
chaincode RecordMilestone ──emits── "MilestoneRecorded" (payload: MilestoneEvent JSON)
        │ committed in a block
        ▼
gateway  GET /events     one chaincode-event subscription per client, from the next block on
        │                 event: MilestoneRecorded / data: <LedgerEvent JSON>; ": ..." keep-alives
        ▼
backend  GET /events     relays the gateway's stream verbatim
        ▼
browser  EventSource("/api/events")   refreshes the open views
```

- `LedgerEvent` is `{name: "MilestoneRecorded", block_number, tx_id, event: MilestoneEvent}`. It
  carries hashes only.
- New events only: there is no replay. A client that reconnects misses events committed while it
  was away and should reload the data it shows.
- `CreateRecord` emits no event.
- With no event source configured the gateway answers LEDGER_UNAVAILABLE (503).

## Endorsement policy

Every write must be endorsed by a peer of Org1MSP (AD bank) and a peer of Org2MSP (exporters'
body): `AND('Org1MSP.peer','Org2MSP.peer')`, set by `network/deploy.sh` from
`S14_ENDORSEMENT_POLICY` (D-05). A transaction endorsed by only one org is ordered but marked
`ENDORSEMENT_POLICY_FAILURE` at commit and changes nothing.
`scripts/e3_endorsement_check.sh` checks both halves on the live network: a one-org
`CreateRecord` is invalidated and creates no record, and a two-org one commits. The policy is a
property of the deployment, not of the chaincode code.

Who may write which milestone is a separate, chaincode-level rule (`WRITER_ROLE`): the
submitting org's role must match, even though both orgs endorse.
