# Contributing

Thanks for helping. This file covers setup, the checks every change must pass, how to change the
shared contracts, the branch rules the repository enforces, and the honesty rules for docs and
data. Coding agents also follow [AGENTS.md](AGENTS.md).

## Development setup

Needs Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node 22 with npm, and Bash (Linux,
macOS, WSL or Git Bash). Docker and a Drunix checkout are needed only for live runs
([docs/RUNBOOK.md](docs/RUNBOOK.md)).

```bash
uv sync
(cd chaincode && npm ci) && (cd gateway && npm ci) && (cd frontend && npm ci)
bash scripts/install-hooks.sh        # installs the pre-push hook (see "Branches")
```

## Commands

```bash
bash scripts/check_all.sh                         # every suite, as CI runs it; must end "all suites green"
uv run pytest                                     # Python: contracts, backend, live tests (skipped without S14_LIVE=1)
cd chaincode && npm run typecheck && npm test     # same in gateway/ and frontend/
S14_LIVE=1 uv run pytest tests/integration        # against a running gateway and Drunix network
```

## Test rules

- **Spec tests define "done"** (D-12). Unimplemented behaviour is a strict
  `xfail(raises=NotImplementedError)` in Python or `it.fails` / `it.todo` in TypeScript. Remove
  the marker in the same change that implements the behaviour.
- **Never weaken a test to get green.** Do not delete, skip or loosen a test or a spec. If a spec
  looks wrong, raise it in an issue or the pull request and leave it in place until it is
  changed on purpose.
- **Fakes are test doubles only** (D-03). Unit tests use `tests/backend/fakes.py` or the
  gateway's `test/fakeLedger.ts` and never need the network. The product runs only on a real
  Drunix network.
- Every new behaviour gets a test in the package that implements it.

## Changing a contract

`backend/s14/contracts.py` is the single source for enums, data shapes, rule tables, error
codes and routes. Never edit `*/src/generated/` by hand, and never fix a parity test by editing
the test or a generated copy. The procedure (details in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), "How to change a contract"):

1. Edit `contracts.py` and bump `CONTRACTS_VERSION` (minor for additions, major for breaking
   changes).
2. `uv run python scripts/export_schema.py`
3. Mirror the change in `contracts/contracts.ts` (and `contracts/parity.ts` if needed).
4. `bash scripts/sync_ts_contracts.sh`
5. Add an entry to [docs/DECISIONS.md](docs/DECISIONS.md).
6. `bash scripts/check_all.sh`

## Branches and pull requests

These rules are enforced today:

- **CI** (`.github/workflows/ci.yml`, job `branch-rules`): pull requests must target `develop`,
  the default and only long-lived branch (`main` is retired, D-16). The source branch must be
  named `p<N>/<topic>` (N from 1 to 5) or `integration/<topic>`.
- **Pre-push hook** (`scripts/hooks/pre-push`, installed by `scripts/install-hooks.sh`): reads
  your contributor id from `git config s14.id`, which must be one of the ids in
  `scripts/team.conf`. You may push only to branches that start with `<your id>/`. Pushing to
  `develop`, `main` or `integration/*`, and pushing tags, is reserved for the maintainer id
  (`LEAD_ID` in `scripts/team.conf`). Deleting or force-pushing `develop` or `main` is refused.
  Never bypass the hook with `--no-verify`.

Day to day:

```bash
git fetch origin
git checkout -b p<N>/<topic> origin/develop
# work, commit
git rebase origin/develop                         # stay current by rebasing, not by merging develop in
bash scripts/check_all.sh
git push --force-with-lease origin p<N>/<topic>  # force-with-lease only on your own branch
gh pr create --base develop
```

Keep pull requests small and focused, and fill in the checklist in
`.github/pull_request_template.md`. Never commit secrets, keys, certificates, salts,
`network/env.sh` or `organizations/`.

## Honesty rules for docs and data

- **No invented facts.** Any claim about Drunix, RBI, DGFT, Customs or CAG must come from
  [docs/PROBLEM.md](docs/PROBLEM.md) or [docs/UNKNOWNS.md](docs/UNKNOWNS.md), or be verified from
  a source and cited, or be labelled `[I]` (inference) or `[U]` (unknown).
- **No performance claims about Drunix.** No benchmarks are published.
- **Do not describe unbuilt features as built.** The roadmap is in [FEATURES.md](FEATURES.md).
- **Demo and seed data are synthetic** and must be labelled so in the UI and in seed files.
- **Only salted hashes go on the ledger.** Raw shipping-bill, IRM and eBRC numbers never do, and
  the salt never goes in git.
- `ledger_time` is when a record was submitted, not when the real-world step happened (U-12).
  Word UI text and docs accordingly.

## Licence

By contributing you agree that your contributions are licensed under the Apache License 2.0
([LICENSE](LICENSE)).
