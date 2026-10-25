# S14 Receipt Book

A pilot for the DRUNIX Hackathon 2026: a shared, tamper-evident, time-stamped record of each
export shipping bill's milestones, kept on **Drunix** (NPCI's Hyperledger Fabric
2.5-compatible blockchain). When the bank's EDPMS update, the exporter's DGFT eBRC and
Customs' ICES records disagree, everyone can see which step is missing, who signed what, and
since when. The problem and its evidence are in [`docs/PROBLEM.md`](docs/PROBLEM.md).

**Status (26 Oct 2026):** contracts 1.0.0, frozen at G1 (D-20). Essential features E1-E10 pass
their unit tests and, since 25 Oct, the live end-to-end suite on a real Drunix network: 14 live
tests, the two-org endorsement check on our own chaincode (E3), and the seeded demo with a
browser check of the UI, all in [`.github/workflows/live.yml`](.github/workflows/live.yml) on a
GitHub-hosted Linux runner (D-33). Gate status is in
[`docs/logs/INTEGRATION_LOG.md`](docs/logs/INTEGRATION_LOG.md). The specs that define each feature
are in the test folders.

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

## Host machine: closing G2-G4

Step-by-step live checks, demo run and gate tags: [`docs/HOST_RUNBOOK.md`](docs/HOST_RUNBOOK.md).

## Run the demo

```bash
bash scripts/demo.sh          # on the host machine that runs the Drunix network
```

Needs `network/env.sh` (copy it from `network/env.example.sh` and edit it), docker, uv, node
and npm; see [`network/README.md`](network/README.md). The script takes the Drunix test network
down and up again, deploys the chaincode, starts the gateway and the backend, seeds 30
synthetic records (demo data, labelled synthetic; the hash salt it uses is demo-only), and
serves the UI at http://localhost:5173. Logs go to `.demo-logs/`.

Run headless on a Drunix network in `.github/workflows/live.yml` (D-33): `loaded 30/30`, six
records in each cause bucket, and a browser check of the four views. Set `S14_DEMO_HEADLESS=1` to
skip the interactive UI and `S14_DEMO_CHECK` to run a command against it.

## Per-package READMEs

[`chaincode/README.md`](chaincode/README.md) ·
[`gateway/README.md`](gateway/README.md) ·
[`backend/README.md`](backend/README.md) ·
[`frontend/README.md`](frontend/README.md)

Licence: Apache-2.0 is intended, to match Drunix (lead to add `LICENSE`).
