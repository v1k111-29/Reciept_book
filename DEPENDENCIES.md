# DEPENDENCIES.md: who needs what from whom, merge order, and software versions

*Owner: p1. Use this to avoid waiting on, and conflicting with, each other.*

## 1. Dependency graph between people

```
                 p1  contracts.py / contracts.ts / schema  (everyone depends on this)
                  │
      ┌───────────┼───────────────┬───────────────┐
      ▼           ▼               ▼               ▼
     p2 ──────▶  p3 ──────────▶  p4 ──────────▶  p5
  chaincode   gateway+network   backend         frontend
      │           │               │               │
      └───────────┴───────┬───────┴───────────────┘
                          ▼
                 p1  integration tests, demo script, merges
```

An arrow means "the right side calls the left side's output". Each side codes against
the **contract**, not against the other person's code. That's why everyone can work in
parallel from G1.

## 2. Dependency list per person

| Id | Needs | From | Contract item | Needed by | Stand-in until then | If late |
|---|---|---|---|---|---|---|
| p2 | frozen contract rules | p1 | `WRITER_ROLE`, `PRECONDITIONS`, `REPEATABLE`, `REFERENCE_REQUIRED`, `ErrorCode` | G1 | draft 0.1.0 (already usable) | rules only change via CCR |
| p2 | a running network to deploy | p3 | `network/up.sh`, `network/deploy.sh` | P2-G1-T2 | unit tests on `rules.ts` | log DEP; lead re-plans |
| p3 | chaincode function names + result shapes | p1 / p2 | `ChaincodeFunction`, `ShippingBillRecord` | G2 | Drunix `asset-transfer-basic` sample | gateway tests use a fake `Ledger` |
| p3 | deployed `receiptbook` chaincode | p2 | P2-G2-T1 | G2 | sample chaincode | log DEP |
| p4 | gateway HTTP API | p3 | `GatewayRequest`/`GatewayResult`, `GATEWAY_ROUTES` | G2 | `tests/backend/fakes.py` | backend fully testable without it |
| p4 | identity per role on the gateway | p3 | `OrgRole` → `S14_<ROLE>_*` env | G2 | FakeGateway ignores identity | log DEP |
| p5 | backend routes | p4 | `BACKEND_ROUTES`, `TimelineView`, `MetricsSummary`, `TxReceipt`, `ErrorBody` | G2 | fixtures in `frontend/test/` | UI fully testable without it |
| p1 | all slices on `develop` | all | everything | G2 for the live test | test stays skipped | gate slips; logged |
| all | host machine with Linux + Docker | team | n/a | G1 | each person's unit tests | decide at G0 (U-11) |

## 3. Merge order

**Within each merge window:** p1 → p2 → p3 → p4 → p5 → p1 (integration).

**Across gates (what must be on `develop` before the next gate's work merges):**

| Before merging G… work | These must be merged and green |
|---|---|
| G1 | G0 reports (all five) |
| G2 | `contracts-v1.0.0` tag; P2-G1-T1 (rules); P3-G1-T1..T3 (network, unknowns, config) |
| G3 | P1-G2-T1 live round-trip green |
| G4 | every E1-E10 acceptance check in `FEATURES.md` |

## 4. Conflict-prone files and the rule for each

| File | Why it conflicts | Rule |
|---|---|---|
| `backend/s14/contracts.py`, `contracts/*`, `*/src/generated/*` | everyone depends on them | p1 only; CCR protocol |
| `pyproject.toml`, `uv.lock` | p4 adds deps; p1 adds test tools | p4 edits; p1 approves; never both in one window |
| `*/package-lock.json` | regenerated on install | only the package owner commits it; never commit a lockfile from another package |
| `docs/logs/*.md` | everyone writes logs | one file per person; only p1 writes `INTEGRATION_LOG.md` |
| `.github/*`, `scripts/*` | shared tooling | p1 only |
| `README.md`, root docs | shared | p1 only; others request changes |

## 5. Machine prerequisites

| Who | Needs | Source |
|---|---|---|
| everyone | git, Python ≥3.11 + `uv`, Node.js 22 + npm, Codex and/or Claude Code | this repo (CI uses Node 22, uv) |
| host machine (p3 drives) | Linux (or WSL2/VM [I]), Docker, Go, jq, Bash ≥4; Drunix clone; `./network.sh prereq` | Drunix test-network README [P, AI-read] |

## 6. Software dependencies (locked versions on 16 Oct 2026)

Exact versions are in the lockfiles. These are what `npm install` / `uv lock` resolved when
the scaffold was built. Add a dependency only inside your own package, and log it (`DEP-…`).

**Python** (`pyproject.toml`, `uv.lock`; owner p4, shared with p1)

| Package | Locked | Used for |
|---|---|---|
| fastapi | 0.143.2 | backend API |
| pydantic | 2.14.1 | contracts and validation |
| httpx | 0.28.1 | gateway client |
| uvicorn | 0.54.0 | dev server |
| pytest (dev) | 9.1.1 | tests |

Known warning: `StarletteDeprecationWarning` about httpx in `TestClient`. Harmless at G0;
p4 decides at G2 whether to act (log as ISS if so).

**Chaincode** (`chaincode/package.json`; owner p2)

| Package | Locked | Note |
|---|---|---|
| fabric-contract-api | 2.5.8 | Fabric 2.5 line, matching Drunix's "backwards compatible with HLF v2.5.x" [P] |
| fabric-shim | 2.5.8 | runtime (`fabric-chaincode-node start`) |
| typescript | 5.9.3 | |
| vitest (dev) | 3.2.7 | |
| @types/node (dev) | 22.20.5 | |

**Gateway** (`gateway/package.json`; owner p3)

| Package | Locked | Note |
|---|---|---|
| @hyperledger/fabric-gateway | 1.13.0 | Fabric Gateway client; Drunix compatibility is U-02 |
| @grpc/grpc-js | 1.14.6 | transport |
| typescript | 5.9.3 | |
| tsx (dev) | 4.23.15 | `npm run dev` |
| vitest (dev) | 3.2.7 | |

**Frontend** (`frontend/package.json`; owner p5)

| Package | Locked |
|---|---|
| react, react-dom | 18.3.1 |
| vite | 6.4.4 |
| @vitejs/plugin-react | 4.7.0 |
| vitest | 3.2.7 |
| jsdom | 25.0.1 |
| @testing-library/react | 16.3.3 |
| @testing-library/jest-dom | 6.9.1 |
| typescript | 5.9.3 |
