# Backend (Python, FastAPI)

The backend sits between the browser and the gateway. It turns what a person types into
salted hashes, sends signed-write requests to the gateway, and turns ledger records into
the cause assessment and the three pilot metrics. It never talks to Drunix directly. It
moves no money and replaces no government system.

All data shapes, enums, error codes and routes come from `backend/s14/contracts.py`
(owner p1, frozen at 1.0.0). Do not edit that file from here.

## Routes

These match `BACKEND_ROUTES` in `contracts.py`. Failed calls return an `ErrorBody` with the
HTTP status from `ERROR_HTTP_STATUS`.

| Route | Request | Response |
|---|---|---|
| `GET /health` | none | `HealthResponse` (`{status, contracts_version}`) |
| `POST /records` | `CreateRecordRequest` | `TxReceipt` |
| `POST /records/{sb_hash}/milestones` | `MilestoneRequest` | `TxReceipt` |
| `GET /records/{sb_hash}` | none | `TimelineView` (record plus assessment) |
| `GET /records` | none | `list[TimelineView]` |
| `GET /metrics` | none | `MetricsSummary` |

`acting_as` in a `MilestoneRequest` picks which org's gateway identity signs. Record
creation always uses the AD bank identity (`CREATE_RECORD_ROLE`). Reads use the AD bank
identity too. The backend does not check `WRITER_ROLE` itself: the chaincode does, and a
wrong role comes back as `WRONG_ROLE` (403). A bad request body gives `VALIDATION` (422).

## Hashing

Raw shipping-bill, IRM and eBRC numbers never go on the ledger. Only salted SHA-256 hashes do.
The code is in `s14/domain/hashing.py`.

- The salt comes from the environment variable `S14_HASH_SALT`. It is never in git.
- If the variable is missing or empty, write routes return `INTERNAL` (500).
- Shipping-bill hash: salt plus `PORTCODE|SBNUMBER|YYYY-MM-DD` (upper-cased, stripped).
- Reference hash: salt plus the stripped reference.
- Blank `sb_number`, `port_code` or `reference` gives `VALIDATION` before any hashing.

## Gateway client

`s14/gateway_client.py` posts `GatewayRequest` JSON to the gateway and reads a `GatewayResult`.

- Base URL: `S14_GATEWAY_URL`, default `http://localhost:8800`. Timeout 10 seconds.
- Writes use `POST /submit`, reads use `POST /evaluate` (`GATEWAY_ROUTES`).
- Network failure becomes `LEDGER_UNAVAILABLE` (503).
- A reply that is not a valid `GatewayResult`, or whose payload does not match the shape in
  `CHAINCODE_RESULT`, becomes `INTERNAL` (500).

## OUTCOME_UNKNOWN

`OUTCOME_UNKNOWN` means a write was sent but its commit status is not known. It may still
commit. The backend never retries or resubmits it. Instead it reads the record back:

- Create: if the record exists, the call succeeds with a `TxReceipt`.
- Milestone: it succeeds only if the record holds an event with the same `tx_id` and milestone.
- Otherwise the client gets `OUTCOME_UNKNOWN` (504). The caller should check the record
  before trying again.

## Retrying MVCC_CONFLICT

The write routes retry a failed submit only when its error code is in `RETRYABLE_ERRORS`, which
holds only `MVCC_CONFLICT`. Fabric invalidated that transaction at commit, so nothing was
recorded and a retry cannot record a milestone twice (D-21). Retry safety on Drunix itself is
[I] until checked against the live network.

- At most 3 submits in total (`MVCC_MAX_ATTEMPTS` in `s14/api.py`), with a fixed 0.2 s wait
  between them (`MVCC_RETRY_BACKOFF_SECONDS`; tests set it to 0).
- If all 3 conflict, the client gets the last `MVCC_CONFLICT` (409).
- `OUTCOME_UNKNOWN` and every other error are never retried. `OUTCOME_UNKNOWN` goes to the
  read-back above, even when it follows a conflict.

## Cause assessment and metrics

`s14/domain/assessment.py` follows `docs/PROBLEM.md` 4.3. It is a heuristic [I]. The latest
Customs observation (greatest `ledger_time`) decides:

| Bucket | When |
|---|---|
| `CONSISTENT` | latest Customs status is not `PENDING`, or there is none |
| `NO_PAYMENT_RECORDED` | pending, and no `PAYMENT_RECEIVED` |
| `DOWNSTREAM_SYNC` | pending, and `EDPMS_MARKED_OFF` is present |
| `EXPORTER_LINKAGE_MISSING` | pending, and `DOCS_ACKNOWLEDGED` is missing |
| `BANK_NOT_MARKED_OFF` | pending, with docs and payment but no mark-off |

`missing` lists the non-repeatable milestones not yet on the record.
`s14/domain/metrics.py` gives the three pilot measures (`docs/PROBLEM.md` 6.6): median days
from document hand-over to acknowledgement, median days from payment to mark-off, and the
share of pending records that already have a mark-off. A measure is `None` when no record
has the needed milestones.

U-12 caveat, as stated in `contracts.py`: `ledger_time` is the time the signed record was
submitted. It is not proof of when the real-world step happened. The two day-count measures
use `ledger_time.date()`, so read them with that in mind. U-12 is still open.

## Seed data

All seed data is synthetic and labelled `synthetic demo data`. Identifiers look like
`SYNTHETIC-SB-0001`.

```bash
PYTHONPATH=backend uv run python -m s14.seed --count 30 --backend http://localhost:8000
```

It writes through the running backend, so the gateway and Drunix network must be up and
`S14_HASH_SALT` must be set on the backend. The default count is 30, rotating through the
five buckets (6 each). The backend URL can also come from `S14_BACKEND_URL`. It prints how
many records loaded and the bucket counts read back from `GET /records`. It exits 1 on any
error. `s14/seed/__init__.py` also has the older `generate_seed_records`, a small two-milestone generator.

## Run and test

```bash
uv sync
export S14_HASH_SALT=<your own value>    # never commit it
export S14_GATEWAY_URL=http://localhost:8800
uv run uvicorn s14.api:app --app-dir backend --port 8000
```

`--app-dir backend` is needed because `pyproject.toml` sets `package = false`, so `s14` is not
installed. Tests get the path from pytest's `pythonpath` setting.

```bash
uv run pytest tests/backend
```

Unit tests need no network. `tests/backend/fakes.py` has `FakeGateway`, an in-memory test
double. The product runs on the real Drunix network.