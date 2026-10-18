# S14 Receipt Book

A pilot for the DRUNIX Hackathon 2026: a shared, tamper-evident, time-stamped record of each
export shipping bill's milestones, kept on **Drunix** (NPCI's Hyperledger Fabric
2.5-compatible blockchain). When the bank's EDPMS update, the exporter's DGFT eBRC and
Customs' ICES records disagree, everyone can see which step is missing, who signed what, and
since when. The problem and its evidence are in [`docs/PROBLEM.md`](docs/PROBLEM.md).

**Status:** scaffold (contracts 1.0.0, frozen at G1, D-20; gate G0 not yet declared: p3 and p4 G0 reports outstanding). No feature is built yet;
the specs that define each feature are in the test folders.

## Start here

| If you are… | Read |
|---|---|
| anyone, first | [`docs/PROBLEM.md`](docs/PROBLEM.md) Parts 1-6, then [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) Parts 1-2 |
| an agent (Codex / Claude Code) | [`AGENTS.md`](AGENTS.md) (Claude Code gets it through [`CLAUDE.md`](CLAUDE.md)) |
| starting a session | [`PROMPTS.md`](PROMPTS.md): G0 kickoff, mid-execution, lead prompts |
| the lead, before anything | [`REPO_SETUP.md`](REPO_SETUP.md) |
| asking "who do I need, when?" | [`DEPENDENCIES.md`](DEPENDENCIES.md) |
| asking "what must we build?" | [`FEATURES.md`](FEATURES.md) |
| branching, rebasing, conflicts | [`docs/GIT_WORKFLOW.md`](docs/GIT_WORKFLOW.md) |
| logging anything | [`docs/logs/README.md`](docs/logs/README.md) |
| decisions and open questions | [`docs/DECISIONS.md`](docs/DECISIONS.md), [`docs/UNKNOWNS.md`](docs/UNKNOWNS.md) |

## Layout

```
backend/s14/contracts.py     shared contracts (p1)            backend/s14/ (rest)   Python API (p4)
contracts/                   schema + TS mirror (p1)          tests/backend/        backend tests (p4)
chaincode/                   Drunix chaincode, TS (p2)        tests/contracts/      contract tests (p1)
gateway/                     Python↔Drunix bridge, TS (p3)    tests/integration/    live tests (p1)
network/                     Drunix test-network wrappers (p3) scripts/, .github/    tooling (p1)
frontend/                    React UI (p5)                    docs/                 docs + logs (p1, logs: each)
```

## Run the checks

```bash
bash scripts/check_all.sh     # Python + chaincode + gateway + frontend, as CI does
```

Licence: Apache-2.0 is intended, to match Drunix (lead to add `LICENSE`).
