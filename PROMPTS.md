# PROMPTS.md: copy-paste prompts for Codex and Claude Code

*Owner: p1. Same prompts work in both tools: paste one as the first message of a session.
Replace every `{PLACEHOLDER}` before sending. Each prompt is written in the voice of the
person driving the agent ("I", "my").*

Placeholders used:

| Placeholder | Meaning | Example |
|---|---|---|
| `{ID}` | your team id | `p3` |
| `{TASK_ID}` | task from IMPLEMENTATION_PLAN.md Part 3 | `P3-G2-T1` |
| `{BRANCH}` | your working branch | `p3/g2-submit-route` |
| `{LAST_SHA}` | `develop` SHA from your previous log entry | `3c77731` |
| `{GATE}` | current gate | `G2` |

**G0 expected counts** (measured when the scaffold was built, 16 Oct 2026):

| Suite | Command | Expect |
|---|---|---|
| Python | `uv sync && uv run pytest` | **26 passed, 13 skipped, 16 xfailed** (1 known warning) |
| Chaincode | `cd chaincode && npm ci && npm run typecheck && npm test` | **11 passed** (2 contract/parity + 9 `it.fails` specs) |
| Gateway | `cd gateway && npm ci && npm run typecheck && npm test` | **4 passed, 5 todo** |
| Frontend | `cd frontend && npm ci && npm run typecheck && npm test` | **2 passed, 9 todo** |

Python skipped went from 2 to 13 on 18 Oct 2026, when the live tests for P1-G2-T1 and P1-G3-T1
landed in `tests/integration/`. Without `S14_LIVE=1` all 13 live tests are skipped.

---

## A. G0 kickoff prompts (one per person, read-only except for the report)

### A1. p1 (lead)

```
<orient>
git checkout develop && git pull. Confirm with git branch that I'm actually on develop, not main or
wherever I was left before. Run git config --get s14.id and confirm it prints p1, and that
scripts/team.conf says LEAD_ID=p1. If either is wrong, stop and tell me.
</orient>
<verify>
Read backend/s14/contracts.py in full. I own it, so check it as the author: every Part 2.3 row of
IMPLEMENTATION_PLAN.md must match a real type or constant, every rule in WRITER_ROLE and PRECONDITIONS
must cite its source or say [I], and contracts/contracts.ts must say the same thing. List anything
unclear, wrong or missing now, before the G1 freeze, not after.
Check .github/CODEOWNERS has no @P*_GITHUB placeholders left and that the ruleset on develop
matches REPO_SETUP.md step 3.
Run: uv sync && uv run pytest (expect 26 passed, 13 skipped, 16 xfailed).
Run: bash scripts/check_all.sh (expect chaincode 11 passed; gateway 4 passed, 5 todo; frontend
2 passed, 9 todo; and "all suites green").
Do not change any file except my log in the report step.
</verify>
<report>
Report plainly: did every install succeed clean, are all four suites actually green with exactly the
counts above (say which differ), is branch protection really on, and what are my own concerns about
contracts.py. This report is my real yes (or not-yet) for G0, not assumed from "it probably worked":
say yes or not-yet explicitly.
Then: git checkout -b p1/g0-report, append the report to docs/logs/p1.md under a "G0 report" heading
using the template in docs/logs/README.md, commit "P1-G0-T2: G0 report", push the branch, and open a PR
to develop. Do not merge anything yet; the other four reports come first.
</report>
```

### A2. p2 (chaincode)

```
<orient>
git checkout develop && git pull. Confirm with git branch that I'm actually on develop, not main or
wherever I was left before. Run git config --get s14.id and confirm it prints p2. If it is empty, set
it with git config s14.id p2 and run bash scripts/install-hooks.sh, then tell me you did.
</orient>
<verify>
Read backend/s14/contracts.py in full, but review closely the types I depend on (Part 2.3 of
IMPLEMENTATION_PLAN.md): I take MilestoneSubmission as input to RecordMilestone and produce
ShippingBillRecord and MilestoneEvent as output, and my rules come from WRITER_ROLE, PRECONDITIONS,
REPEATABLE, REFERENCE_REQUIRED, DEFAULT_MSP_ROLES, HASH_PATTERN and ErrorCode. Check that
chaincode/src/generated/contracts.ts says the same as contracts.py, and that the spec in
chaincode/test/rules.spec.test.ts is achievable with those rules. Flag anything unclear, wrong or
missing now, before it's frozen at G1, not after.
Read docs/UNKNOWNS.md items U-07 (TypeScript chaincode on Drunix) and U-12 (what the transaction
timestamp proves), which are mine to help close.
Run: uv sync && uv run pytest (expect 26 passed, 13 skipped, 16 xfailed).
Run: cd chaincode && npm ci && npm run typecheck && npm test (expect 11 passed: 2 contract/parity tests
and 9 it.fails specs).
Do not change any file except my log in the report step.
</verify>
<report>
Report plainly: did the install succeed clean, are both suites actually green with exactly those
counts, and do I have any concerns about the contracts.py types and rules I depend on. This report is
my real yes (or not-yet) for G0, not assumed from "it probably worked": say yes or not-yet explicitly.
Then: git checkout -b p2/g0-report, append the report to docs/logs/p2.md under "G0 report" using the
template in docs/logs/README.md, commit "P2-G0-T2: G0 report", push the branch, open a PR to develop.
</report>
```

### A3. p3 (gateway + Drunix network)

```
<orient>
git checkout develop && git pull. Confirm with git branch that I'm actually on develop, not main or
wherever I was left before. Run git config --get s14.id and confirm it prints p3. If it is empty, set
it with git config s14.id p3 and run bash scripts/install-hooks.sh, then tell me you did.
</orient>
<verify>
Read backend/s14/contracts.py in full, but review closely the types I depend on (Part 2.3 of
IMPLEMENTATION_PLAN.md): I take GatewayRequest as input and produce GatewayResult and ErrorBody, I
route by GATEWAY_ROUTES, call ChaincodeFunction names, pick an identity by OrgRole using
DEFAULT_MSP_ROLES, and map chaincode errors ("<ErrorCode>: message") to ErrorCode. Flag anything
unclear, wrong or missing now, before it's frozen at G1, not after.
Read network/README.md and docs/UNKNOWNS.md items U-02, U-03, U-04, U-05, U-06 and U-11, which are mine.
On this machine, check (read-only, install nothing) and write down the exact output of:
uname -a; docker --version; go version; jq --version; bash --version | head -1. This tells us whether
this can be the host machine for the Drunix network.
Run: uv sync && uv run pytest (expect 26 passed, 13 skipped, 16 xfailed).
Run: cd gateway && npm ci && npm run typecheck && npm test (expect 4 passed, 5 todo).
Do not change any file except my log in the report step.
</verify>
<report>
Report plainly: did the install succeed clean, are both suites actually green with exactly those
counts, can this machine host Drunix (Linux/WSL2, Docker, Go, jq, Bash 4+: yes or no for each), and
do I have any concerns about the contracts.py types I depend on. This report is my real yes (or
not-yet) for G0, not assumed from "it probably worked": say yes or not-yet explicitly.
Then: git checkout -b p3/g0-report, append the report to docs/logs/p3.md under "G0 report" using the
template in docs/logs/README.md, commit "P3-G0-T2: G0 report", push the branch, open a PR to develop.
</report>
```

### A4. p4 (Python backend)

```
<orient>
git checkout develop && git pull. Confirm with git branch that I'm actually on develop, not main or
wherever I was left before. Run git config --get s14.id and confirm it prints p4. If it is empty, set
it with git config s14.id p4 and run bash scripts/install-hooks.sh, then tell me you did.
</orient>
<verify>
Read backend/s14/contracts.py in full, but review closely the types I depend on (Part 2.3 of
IMPLEMENTATION_PLAN.md): I take CreateRecordRequest and MilestoneRequest from the frontend and
GatewayResult (with ShippingBillRecord payloads) from the gateway; I produce TxReceipt, TimelineView,
CauseAssessment, MetricsSummary and ErrorBody for the frontend, and MilestoneSubmission inside a
GatewayRequest for the gateway. Read the specs I must satisfy: tests/backend/test_hashing_spec.py,
test_assessment_spec.py and test_metrics_spec.py, plus the docstrings in backend/s14/domain/. Check
that each spec is achievable with the contract as written. Flag anything unclear, wrong or missing
now, before it's frozen at G1, not after.
Run: uv sync && uv run pytest (expect 26 passed, 13 skipped, 16 xfailed; the 16 xfailed are my specs).
Run: cd frontend && npm ci && npm test (expect 2 passed, 9 todo), to see what my API's caller expects.
Do not change any file except my log in the report step.
</verify>
<report>
Report plainly: did the install succeed clean, are both suites actually green with exactly those
counts, and do I have any concerns about the contracts.py types I depend on or about my specs. This
report is my real yes (or not-yet) for G0, not assumed from "it probably worked": say yes or
not-yet explicitly.
Then: git checkout -b p4/g0-report, append the report to docs/logs/p4.md under "G0 report" using the
template in docs/logs/README.md, commit "P4-G0-T2: G0 report", push the branch, open a PR to develop.
</report>
```

### A5. p5 (frontend)

```
<orient>
git checkout develop && git pull. Confirm with git branch that I'm actually on develop, not main or
wherever I was left before. Run git config --get s14.id and confirm it prints p5. If it is empty, set
it with git config s14.id p5 and run bash scripts/install-hooks.sh, then tell me you did.
</orient>
<verify>
Read backend/s14/contracts.py in full, but review closely the types I depend on (Part 2.3 of
IMPLEMENTATION_PLAN.md): I receive TxReceipt, TimelineView, CauseAssessment, MetricsSummary and
ErrorBody from the backend, and I send CreateRecordRequest and MilestoneRequest. I use BACKEND_ROUTES
for paths and WRITER_ROLE to decide which milestones each desk may offer. Check that
frontend/src/generated/contracts.ts matches, and read frontend/test/api.spec.test.ts (my todos).
Flag anything unclear, wrong or missing now, before it's frozen at G1, not after.
Run: uv sync && uv run pytest (expect 26 passed, 13 skipped, 16 xfailed).
Run: cd frontend && npm ci && npm run typecheck && npm test (expect 2 passed, 9 todo).
Do not change any file except my log in the report step.
</verify>
<report>
Report plainly: did the install succeed clean, are both suites actually green with exactly those
counts, and do I have any concerns about the contracts.py types I depend on. This report is my real
yes (or not-yet) for G0, not assumed from "it probably worked": say yes or not-yet explicitly.
Then: git checkout -b p5/g0-report, append the report to docs/logs/p5.md under "G0 report" using the
template in docs/logs/README.md, commit "P5-G0-T2: G0 report", push the branch, open a PR to develop.
</report>
```

---

## B. Mid-execution prompt (every working session from G1 on, everyone)

One template for all five; fill the placeholders. The `<scope>` lines per person are in B2.

### B1. Template

```
<orient>
git fetch origin. Run git config --get s14.id and confirm it prints {ID}. Then
git checkout {BRANCH} (if it doesn't exist yet: git checkout -b {BRANCH} origin/develop).
Confirm with git branch --show-current that I'm on {BRANCH}, and never on develop or main. Then
git rebase origin/develop. If the rebase conflicts in any file I don't own (Part 2.2 of
IMPLEMENTATION_PLAN.md / .github/CODEOWNERS), run git rebase --abort, log it as a CNF entry in
docs/logs/{ID}.md and stop. If it conflicts only in my own files, resolve them and log a CNF entry
saying what I kept.
</orient>
<verify>
Show me what landed on develop since my last session: git log --oneline {LAST_SHA}..origin/develop.
If backend/s14/contracts.py, contracts/ or any src/generated/ changed, read the diff and re-check the
types I depend on (Part 2.3), and tell me exactly what changed for me.
Read the latest entry in docs/logs/INTEGRATION_LOG.md and the open items in my own log
docs/logs/{ID}.md.
Run my suites before touching code and note the counts:
{MY_SUITE_COMMANDS}
If the counts differ from my last log entry and I don't know why, stop and report it. Don't continue.
</verify>
<task>
Continue {TASK_ID} from Part 3 of IMPLEMENTATION_PLAN.md (acceptance criteria there and in
FEATURES.md). {SCOPE}
Make the relevant spec tests pass and remove their xfail / it.fails / it.todo markers in the same
commit; add a test for every new behaviour. Do not weaken or delete any test.
If I need a change in a file I don't own, a contract change, or a dependency outside my package: don't
make it. Write it in my log as a request (REQ / CCR / DEP entry) and tell me.
Commit in small steps with messages starting "{TASK_ID}: ".
</task>
<log>
Append a session entry to docs/logs/{ID}.md using the template in docs/logs/README.md: date, branch,
the develop SHA I rebased on, what I did, exact test counts, and every issue (ISS), conflict (CNF),
missing dependency (DEP), contract request (CCR) and request to others (REQ) with its own ID, plus the
next step. Log anything that doesn't match develop or the contract, even if I worked around it.
</log>
<report>
Report plainly: what is done for {TASK_ID}, are my suites actually green (exact counts) and is
bash scripts/check_all.sh green, what is blocked and on whom, and whether the branch is ready for a PR
to develop. Say "ready" or "not ready" explicitly, not assumed. If ready: push with
git push --force-with-lease origin {BRANCH} and open or update the PR using the template.
</report>
```

### B2. Fill-ins per person

| Id | `{MY_SUITE_COMMANDS}` | `{SCOPE}` |
|---|---|---|
| p1 | `bash scripts/check_all.sh` and (on the host machine, from G2) `S14_LIVE=1 uv run pytest tests/integration` | Only contracts, scripts, .github, docs, tests/contracts, tests/integration, tests/factories.py. Never edit another slice's code, even to fix integration; log and assign instead. |
| p2 | `cd chaincode && npm ci && npm run typecheck && npm test` | Only chaincode/ (never chaincode/src/generated/). All decisions go in rules.ts, which stays pure (no Fabric imports); receiptBook.ts only reads and writes state and calls rules. Errors are thrown as "<ErrorCode>: message". |
| p3 | `cd gateway && npm ci && npm run typecheck && npm test`, plus `bash network/up.sh` / `deploy.sh` when the task touches the network (paste the output into my log) | Only gateway/ (never src/generated/) and network/. The gateway has no business rules: it forwards GatewayRequest to Drunix and maps results and errors to GatewayResult. Close UNKNOWNS items with evidence (command + output). |
| p4 | `uv sync && uv run pytest` | Only backend/s14/ (never contracts.py), tests/backend/, and pyproject.toml/uv.lock for my own deps. Raw sb_number, IRM and eBRC values are hashed with the S14_HASH_SALT env var and never logged or sent to the gateway. Use FakeGateway in unit tests. |
| p5 | `cd frontend && npm ci && npm run typecheck && npm test` | Only frontend/ (never src/generated/). All data goes through src/api.ts to the backend; never call the gateway. Desks offer only milestones that WRITER_ROLE allows. Synthetic data is labelled "synthetic demo data" on screen. |

---

## C. Lead-only prompts (p1)

### C1. Merge window

```
<orient>
git checkout develop && git pull. Confirm with git branch that I'm on develop and that
git config --get s14.id prints p1.
</orient>
<verify>
List the open PRs into develop (gh pr list --base develop). For each, in the order p1 → p2 → p3 → p4 →
p5 → p1, check: CI green, Code Owner approval present, the PR touches only its author's files (compare
gh pr diff --name-only against Part 2.2 of IMPLEMENTATION_PLAN.md), the checklist is true, and the
author's log has this session's entry. Report any PR that fails a check and why. Don't merge it.
</verify>
<task>
Merge the PRs that pass, one at a time, with a merge commit (gh pr merge <n> --merge; --admin only
for my own PRs). After EACH merge: git pull && bash scripts/check_all.sh. If develop goes red, stop
merging and revert through a PR as in docs/GIT_WORKFLOW.md (branch p1/revert-pr<n>, git revert -m 1,
PR into develop). Never push to develop directly. Never edit a member's code to make it merge; send it
back.
</task>
<log>
On a p1/... branch off origin/develop, append a merge-window entry to docs/logs/INTEGRATION_LOG.md
and open a PR into develop for it: time, each PR (merged / sent back / reverted,
and why), the develop SHA and suite counts after each merge, open conflicts, missing dependencies and
contract requests across the team, with their IDs.
</log>
<report>
Report plainly: what was merged, is develop actually green now (exact counts), what was sent back to
whom, and what blocks the current gate.
</report>
```

### C2. Gate close

```
<orient>
git checkout develop && git pull --ff-only. Confirm I'm on develop and that s14.id is p1. Note the
develop SHA (git rev-parse HEAD): it is the SHA I verify and tag.
</orient>
<verify>
For gate {GATE}, go through every "Accept when" row in Part 3 of IMPLEMENTATION_PLAN.md (and the
FEATURES.md rows for G3/G4) and show the evidence for each: test name and result, or log entry ID.
Run bash scripts/check_all.sh and, from G2, S14_LIVE=1 uv run pytest tests/integration on the host
machine. Mark each row met / not met. Don't round up.
</verify>
<report>
Report plainly: is {GATE} met, yes or not-yet, with the unmet rows listed. If yes and only then:
append a gate-close entry (with the verified SHA) to docs/logs/INTEGRATION_LOG.md on a p1/... branch
and open a PR into develop for it. Ask me before tagging. On my yes:
git tag -a {GATE_TAG} <verified-sha> -m "Gate {GATE} close" and git push origin {GATE_TAG}.
Gates close with a tag on develop; main is retired (D-16): never push to it or open a PR into it.
</report>
```

### C3. Contract change (CCR)

```
<orient>
git checkout -b p1/ccr-{N} origin/develop. Confirm the branch and that s14.id is p1.
</orient>
<verify>
Read CCR-{N} in the requester's log, and list every owner affected using Part 2.3 of
IMPLEMENTATION_PLAN.md. Say whether the change is additive (minor bump) or breaking (major bump).
</verify>
<task>
Edit backend/s14/contracts.py and contracts/contracts.ts identically, bump CONTRACTS_VERSION in both,
run uv run python scripts/export_schema.py and bash scripts/sync_ts_contracts.sh, add contract tests for
the change in tests/contracts/, and add a line to docs/DECISIONS.md. Run bash scripts/check_all.sh.
</task>
<report>
Report plainly: the diff summary, the new version, suites green (exact counts), and the exact message
to send the affected owners telling them to rebase.
</report>
```
