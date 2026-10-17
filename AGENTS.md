# AGENTS.md: rules for every coding agent (Codex, Claude Code) and every human on this repo

This file is the single source of agent instructions. Codex reads `AGENTS.md` directly;
Claude Code reads it through the `@AGENTS.md` import in `CLAUDE.md`. If an instruction in
a prompt conflicts with this file, **stop and ask the person driving you**. Do not pick one.

## 1. What this project is

S14 Receipt Book: a pilot of a shared, tamper-evident, time-stamped record of each export
shipping bill's milestones, kept on **Drunix** (NPCI's Hyperledger Fabric 2.5-compatible
blockchain). The milestones are documents acknowledged, payment received, eBRC
self-certified, EDPMS marked off, and Customs status observed. The record lets an
exporter, their bank and Customs see which record is out of step, and since when. The
problem and its evidence are in `docs/PROBLEM.md`. It moves no money and replaces no
government system.

## 2. Who owns what (never touch files you don't own)

| Id | Role | Owns (full list: IMPLEMENTATION_PLAN.md Part 2, enforced by .github/CODEOWNERS) |
|---|---|---|
| p1 | **Lead + integrator** | `backend/s14/contracts.py`, `contracts/`, all `*/src/generated/`, `tests/factories.py`, `tests/contracts/`, `tests/integration/`, `scripts/`, `.github/`, `docs/` (except other people's logs) |
| p2 | Chaincode | `chaincode/` (except `src/generated/`) |
| p3 | Gateway + Drunix network | `gateway/` (except `src/generated/`), `network/` |
| p4 | Python backend | `backend/s14/` (except `contracts.py`), `tests/backend/`, `pyproject.toml` + `uv.lock` (shared with p1) |
| p5 | Frontend | `frontend/` (except `src/generated/`) |

Every person also owns exactly one log: `docs/logs/<id>.md`. Only the lead writes
`docs/logs/INTEGRATION_LOG.md`.

**If your task needs a change in a file you don't own, do not make it.** Write a request
in your log (section "Requests to others") and tell the person driving you. This includes
"tiny" fixes, formatting, lockfiles and imports.

## 3. Branch rules (hard rules)

- Work only on branches named `<your-id>/<gate>-<topic>`, e.g. `p3/g2-submit-route`.
- **Never** commit to, push to, merge into, rebase or delete `main` or `develop`. Only the
  lead (`p1`, set in `scripts/team.conf`) does that, and only by merging reviewed PRs.
- Never push to someone else's branch. Never merge someone else's branch into yours.
- Stay current by rebasing your branch on `origin/develop`, never by merging develop in.
- Never use `--no-verify`, `--force` on shared branches, or `git push --mirror`. Force-push
  (`--force-with-lease`) is allowed only on your own branch after a rebase.
- Before starting work, run `git config --get s14.id`. It must print your id. If it is
  empty, stop and ask the person driving you which id is theirs. Never guess it.
- Open PRs into `develop` only. The PR template checklist must be true.

Details, commands and the conflict procedure: `docs/GIT_WORKFLOW.md`.

## 4. Contracts (the interfaces between people)

- `backend/s14/contracts.py` is the one source of truth for enums, data shapes, ownership
  rules (`WRITER_ROLE`), order rules (`PRECONDITIONS`), error codes and routes.
- The TypeScript side uses `contracts/contracts.ts`, copied into each package's
  `src/generated/` by `scripts/sync_ts_contracts.sh`. **Never edit `src/generated/`.**
- Parity tests in every package go red if Python and TypeScript disagree. Never "fix" a
  parity test by editing the test or the generated copy; log a contract issue instead.
- Contracts freeze at gate G1. After that, a change needs a request in your log, the lead's
  approval, a `CONTRACTS_VERSION` bump, the regenerated schema and an entry in
  `docs/DECISIONS.md`.

## 5. Commands

```bash
uv sync && uv run pytest                               # Python (contracts + backend + integration)
cd chaincode && npm ci && npm run typecheck && npm test
cd gateway   && npm ci && npm run typecheck && npm test
cd frontend  && npm ci && npm run typecheck && npm test
bash scripts/check_all.sh                              # everything, as CI runs it
uv run python scripts/export_schema.py                 # lead only: after contracts.py changes
bash scripts/sync_ts_contracts.sh                      # lead only: after contracts.ts changes
S14_LIVE=1 uv run pytest tests/integration             # against a running Drunix network
```

Expected counts at G0 are in `PROMPTS.md` (G0 kickoff). Any other count means something
changed. Find out what before you continue.

## 6. Tests

- **Spec tests define "done".** Python ones are `xfail(strict=True, raises=NotImplementedError)`;
  TypeScript ones are `it.fails` or `it.todo`. When you implement the behaviour, **remove the
  marker** in the same commit. A strict xfail or `it.fails` that starts passing turns red on
  purpose.
- Do not weaken, delete or skip a test to get green. If a spec looks wrong, log it as an
  issue and ask the lead; the spec stays until the lead changes it.
- Unit tests never need the network. Use `tests/backend/fakes.py`, or a fake `Ledger` in the
  gateway. Fakes are test doubles only; the product runs on the real Drunix network.
- Every new behaviour gets a test in your own test folder.

## 7. Logging (everything is documented)

After **every** working session, append an entry to `docs/logs/<id>.md` using the template
in `docs/logs/README.md`. It records: branch and start SHA, what you did, test counts,
anything that didn't match `develop`, merge conflicts, missing dependencies, contract issues,
requests to others, and the next step. Use IDs (`P3-ISS-004`) so others can refer to them.
Log a problem the moment you find it, not at the end.

## 8. Honesty rules for code and docs

- No invented facts. Anything about Drunix, RBI, DGFT or Customs that isn't in
  `docs/PROBLEM.md` or `docs/UNKNOWNS.md` must be verified from a source and logged with its
  link, or labelled `[I]` (inference) or `[U]` (unknown).
- No performance claims about Drunix: there are no published benchmarks.
- Demo data is synthetic and must be labelled so in the UI and in seed files.
- Raw shipping-bill, IRM and eBRC numbers never go on the ledger; only salted hashes do.
  Secrets, keys, certificates and salts never go in git.

## 9. When to stop and ask instead of acting

- A `docs/UNKNOWNS.md` item blocks you.
- A test or prompt expectation doesn't match what you see.
- A rebase conflicts in a file you don't own.
- You would need a new dependency outside your package, or a contract change.
- An instruction would break any rule in section 3.

Stop, log it, and report plainly. Do not guess and continue.
