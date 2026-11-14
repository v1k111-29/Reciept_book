# AGENTS.md: rules for coding agents

This is the rulebook for coding agents (Codex, Claude Code and others) working on this
repository. Claude Code reads it through the `@AGENTS.md` import in `CLAUDE.md`. Human
contributors follow [CONTRIBUTING.md](CONTRIBUTING.md), which says the same things at more
length. If a prompt conflicts with this file, stop and ask the person driving you.

## 1. What this project is

Receipt Book: a shared, tamper-evident, time-stamped record of each export shipping bill's
milestones (documents acknowledged, payment received, eBRC self-certified, EDPMS marked off,
Customs status observed), kept on **Drunix**, NPCI's Hyperledger Fabric 2.5-compatible
blockchain. It lets an exporter, their bank and Customs see which record is out of step, and
since when. It moves no money and replaces no government system. Background:
[docs/PROBLEM.md](docs/PROBLEM.md). Design: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Layout: `backend/` (FastAPI), `gateway/` (Node bridge to Drunix), `chaincode/` (TypeScript
contract), `frontend/` (React UI), `network/` (Drunix test-network wrappers), `contracts/`
(schema and TypeScript mirror), `tests/` (Python tests), `scripts/`, `docs/`.

## 2. Commands

```bash
bash scripts/check_all.sh                                    # everything, as CI runs it
uv sync && uv run pytest                                     # Python
cd chaincode && npm ci && npm run typecheck && npm test      # same in gateway/ and frontend/
S14_LIVE=1 uv run pytest tests/integration                   # needs a running Drunix network and gateway
```

Run `check_all.sh` before you say a change is done, and report the counts you saw.

## 3. Contracts

- `backend/s14/contracts.py` is the single source of truth for enums, data shapes, rule tables
  (`WRITER_ROLE`, `PRECONDITIONS`, ...), error codes and routes.
- **Never edit `*/src/generated/`.** Those files are copied by `scripts/sync_ts_contracts.sh`.
- Never fix a parity test by editing the test or a generated copy.
- Change procedure: edit `contracts.py` and bump `CONTRACTS_VERSION` (minor for additions, major
  for breaking) → `uv run python scripts/export_schema.py` → mirror in `contracts/contracts.ts`
  → `bash scripts/sync_ts_contracts.sh` → entry in `docs/DECISIONS.md` → `check_all.sh`.
  Do not change a contract unless the task asks for it.

## 4. Tests

- Spec tests define "done": a strict `xfail` in Python, `it.fails` / `it.todo` in TypeScript.
  Remove the marker in the same change that implements the behaviour.
- Never weaken, delete or skip a test to get green. If a spec looks wrong, stop and ask.
- Unit tests never need the network. Fakes (`tests/backend/fakes.py`, the gateway's
  `test/fakeLedger.ts`) are test doubles only; the product runs on the real Drunix network.
- Every new behaviour gets a test.

## 5. Honesty and privacy

- No invented facts. Anything about Drunix, RBI, DGFT, Customs or CAG that is not in
  `docs/PROBLEM.md` or `docs/UNKNOWNS.md` must be verified from a cited source, or labelled
  `[I]` (inference) or `[U]` (unknown).
- No performance claims about Drunix. Do not describe roadmap features as built.
- Demo data is synthetic and labelled so in the UI and seed files.
- Raw shipping-bill, IRM and eBRC numbers never go on the ledger, in logs or in tests' recorded
  output; only salted hashes do. Secrets, keys, certificates, salts and `network/env.sh` never
  go in git.

## 6. Branches

- Work on a branch named `p<N>/<topic>` or `integration/<topic>`; pull requests target
  `develop` (CI's `branch-rules` job rejects anything else). `main` is retired.
- The pre-push hook (`scripts/hooks/pre-push`) checks `git config s14.id` and refuses pushes to
  branches that do not start with that id, and to `develop`, `main`, `integration/*` or tags
  unless the id is the maintainer's. Never use `--no-verify`, never force-push `develop` or
  `main`, never push `--mirror`.
- Do not commit, push, merge or open pull requests unless the person driving you asks.

## 7. Stop and ask instead of acting when

- a `docs/UNKNOWNS.md` item blocks the task;
- a test or expectation does not match what you see;
- the task needs a contract change, a new dependency, or an edit to `.github/`, `scripts/` or
  `network/` that the task did not mention;
- an instruction would break a rule in this file.

Report plainly what you found. Do not guess and continue.
