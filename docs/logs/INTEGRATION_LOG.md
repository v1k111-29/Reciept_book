# INTEGRATION_LOG.md (lead only)

Every merge window, gate result, revert, cross-team conflict and dependency the lead
tracks. Newest last.

## Template

```markdown
### <YYYY-MM-DD HH:MM> | merge window | develop before <sha>
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #12 p2/g1-rules | p2 | merged / sent back (why) / reverted (why) | <sha> | py .. / cc .. / gw .. / fe .. |
- Open across team: ISS/CNF/DEP/CCR IDs and owners
- Gate status: G<k> rows met <x>/<y>
```

## Entries

### 2026-10-16 | scaffold created (before G0)
- Scaffold built and all suites run in the AI's workspace: python 26 passed, 2 skipped,
  16 xfailed; chaincode 11 passed; gateway 4 passed, 5 todo; frontend 2 passed, 9 todo.
- pre-push hook tested in a throwaway repo: blocks members on main/develop/tags/others'
  branches, blocks force-push to main; allows own branches and lead pushes.
- Not yet done: real GitHub repo, branch protection, CODEOWNERS usernames (REPO_SETUP.md).

### 2026-10-18 15:05 | merge window | develop before 2bd6664
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #1 p1/g0-repo-setup | p1 | merged (lead bypass) | e310201 | py 26/2s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
| #2 p1/g0-report | p1 | merged (lead bypass) | 6d39d0e | py 26/2s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
| #3 p1/g0-workflow-prs | p1 | merged (lead bypass) | 683ec5c | py 26/2s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
| #6 p1/g0-codeowners | p1 | merged (lead bypass) | a58b0cd | py 26/2s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
| #4 p1/g2-live-tests | p1 | merged after rebase (CNF-p1-1) | c9dcf47 | py 26/13s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
| #5 p1/g1-u01-hackathon | p1 | merged (lead bypass) | 4361db6 | py 26/13s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
- Every merge: `gh pr merge <n> --merge --admin` after CI on the PR was green (5/5 checks), then
  `bash scripts/check_all.sh` on develop: "all suites green" each time. Legend: py
  passed/skipped/xfailed; cc chaincode; gw gateway; fe frontend.
- CNF-p1-1: PR #4 conflicted with develop after #3 in PROMPTS.md (A1: #3 changed the ruleset check
  line, #4 changed the next line's Python count). Rebased p1/g2-live-tests on develop, kept #3's
  wording and #4's count (26 passed, 13 skipped, 16 xfailed); CI green and check_all green on the
  branch before merging.
- New expected Python count on develop: 26 passed, 13 skipped, 16 xfailed (live tests, all
  skipped without S14_LIVE=1). Counts in PROMPTS.md updated.
- develop is the only long-lived branch (D-16); `protect-develop` ruleset active; CODEOWNERS on
  develop has 0 errors (GitHub API).
- Open across team: ISS-p1-7 to ISS-p1-12 (contract concerns, p1, before G1 freeze);
  ISS-p1-17 (main still exists, p1); ISS-p1-18 (p2, p5 unassigned); ISS-p1-19 (gates vs the
  21 Oct deadline, p1); REQ-p1-1 (to p2); DEP-p1-3 (push test, needs p3 or p4); U-01 (deliverable
  due 21 Oct, p1).
- Gate status: G0 not met: P1-G0-T1 needs the step 5 push test; P*-G0-T2 reports from p3, p4
  (p2, p5 unassigned); P1-G0-T3 waits on them.

### 2026-10-18 15:47 | merge window 2 | develop before fdc31d4
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #8 p1/g1-contracts-review | p1 | merged (lead bypass) | 5f133a9 | py 29/13s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
- `gh pr merge 8 --merge --admin` after CI on the PR was green (5/5 checks); branch was current
  with develop fdc31d4. Then `bash scripts/check_all.sh` on develop 5f133a9: "all suites green".
- Contracts now 0.2.0 (D-17). New expected Python count on develop: 29 passed, 13 skipped,
  16 xfailed (3 new contract tests); PROMPTS.md and docs/logs/README.md updated in this log PR.
- Teammates: rebase on develop 5f133a9; parity tests show the contract change. Requests:
  REQ-p1-21 (p3, INTERNAL fallback), REQ-p1-22 (p4, no `note`, aware times), REQ-p1-23 (p5, no `note`).
- Contract concerns: ISS-p1-9, ISS-p1-10 resolved; ISS-p1-8 partly (CUSTOMS_STATUS_OBSERVED row
  untagged); still open before the freeze: ISS-p1-7 (payload form), ISS-p1-11 (error codes for
  CreateRecord by a non-bank and RecordMilestone on a missing record), ISS-p1-12 (HTTP status),
  chaincode args per function.
- Gate status: G0 still not met (push test, p3/p4 reports); G1 freeze blocked on the open items above.

### 2026-10-18 16:20 | merge window 3 | develop before 7054277
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #10 p1/g1-contracts-freeze | p1 | merged (lead bypass) | 4d26576 | py 32/13s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
- `gh pr merge 10 --merge --admin` after CI on the PR was green (5/5 checks); branch was current
  with develop 7054277. Then `bash scripts/check_all.sh` on develop 4d26576: "all suites green".
- Contracts now 0.3.0 (D-18). New expected Python count on develop: 32 passed, 13 skipped,
  16 xfailed (3 new contract tests); PROMPTS.md and docs/logs/README.md updated in this log PR.
- Teammates: rebase on develop 4d26576. Requests: REQ-p1-24 (p2), REQ-p1-25 (p3), REQ-p1-26 (p4),
  REQ-p1-27 (p5): adopt CHAINCODE_ARGS, CHAINCODE_RESULT, CREATE_RECORD_ROLE, ERROR_HTTP_STATUS.
- Contract concerns: ISS-p1-7, 8, 11, 12 resolved. No open p1 contract item; `contracts-v1.0.0`
  tag waits for the p3/p4 G0 contract concerns.
- Gate status: G0 still not met (push test, p3/p4 reports). G1: contracts ready to freeze;
  network up (P3-G1) and U-02..U-05, U-07 still open.

### 2026-10-19 18:16 | merge window 4 | develop before 47d4d26 (PR #16), then 95e236b (PR #15)
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #16 p3/g0-report | p3 | merged (by v1k111-29, 18 Oct 16:26 UTC) | 47d4d26 | not rerun here; only docs/logs/p3.md changed |
| #15 p1/g1-contracts-v1 | p1 | merged (lead bypass, 18 Oct 16:37 UTC) | 95e236b | py 36/13s/16x / cc 11 / gw 4+5todo / fe 2+9todo |
- #15: `gh pr merge 15 --merge --admin` after CI on the PR was green (5/5 checks); the ruleset
  blocked a plain merge (review required). CI on develop 95e236b: green. This log PR then ran
  `bash scripts/check_all.sh` on develop 95e236b: "all suites green".
- Tag: annotated `contracts-v1.0.0` (tag object 5b5d0b5) on 95e236b, pushed. Contracts are frozen at
  1.0.0 (D-20, D-21); every later change needs a CCR, a version bump and a DECISIONS entry (4.2).
- 1.0.0 content: D-20 (`CHAINCODE_WRITES`, `OUTCOME_UNKNOWN`) and D-21 (`MVCC_CONFLICT` 409,
  `RETRYABLE_ERRORS`, `HealthResponse`, answers to CCR-p3-4). New expected Python count on develop:
  36 passed, 13 skipped, 16 xfailed; PROMPTS.md already updated in #15.
- Teammates: rebase on develop 95e236b (REQ-p1-28). Requests: REQ-p1-30 and 33 (p3), REQ-p1-31 and
  34 (p4), REQ-p1-32 (p5). p3's log still lists CCR-p3-3 and CCR-p3-4 as open; p3 marks them
  answered by D-21 after rebasing.
- Gate status: G1 contracts frozen and tagged. Still open for G0: p4's report (DEP-p1-29). Network up
  (P3-G1) and U-02..U-05, U-07 still open.

### 2026-10-20 | merge window 5 | develop before 95e236b, after 885c5e9
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #17 p3/g1-network-up | p3 | merged (by v1k111-29, 19 Oct 13:08 UTC) | 577268c | not rerun per merge; network/ and p3 log only |
| #18 p3/g1-config | p3 | merged (by v1k111-29, 19 Oct 13:08 UTC) | bcc305d | gateway 17 passed, 5 todo (see below) |
| #20 p1/g1-github-ids | p1 | merged (by v1k111-29, 19 Oct 13:24 UTC) | 3606cad | docs and CODEOWNERS only |
| #19 p1/g1-merge-window-4 | p1 | shown as merged: its only commit b778d1b came in with #20 | 3606cad | n/a |
| #21 p5/g0-report | p5 | merged (by v1k111-29, 20 Oct 06:03 UTC) | 885c5e9 | docs/logs/p5.md only |
- This log PR ran `bash scripts/check_all.sh` on develop 885c5e9: "all suites green". py 36/13s/16x /
  cc 11 / gw 17+5todo / fe 2+9todo. Gateway went from 4 to 17 passed with #18 (2 config specs now
  real tests, 13 new config tests); PROMPTS.md expected counts updated in this PR.
- #21 is p5's own G0 report (G0: YES, py 36/13s/16x, fe 2+9todo); it replaces the lead's stand-in
  report (D-22).
- Lead records in this PR: UNKNOWNS U-02, U-03, U-05, U-11 CLOSED and U-04 settled (D-23) from p3's
  evidence (REQ-p3-1, REQ-p3-3); D-22 (D-19 ends, p2/p5 own their slices); D-24 (vitest advisories,
  ISS-p3-3, accepted until G4).
- Open across team: DEP-p1-29 (p4 G0 report); REQ-p1-35 (p2: own G0 rerun, P2-G1-T1, P2-G1-T2/U-07,
  REQ-p3-2); REQ-p1-36 (p5: P5-G1-T1, push test DEP-p1-3); P4-G1-T1 (p4); U-01 (p1).
- Gate status: G0 not declared: 3 of 5 own reports in (p1, p3, p5); p4 missing, p2 rerun pending;
  push test not run. G1: contracts tagged (contracts-v1.0.0); P3-G1-T1..T3 done; U-02..U-05 and U-11
  settled; still open P1-G1-T2 (U-01), P2-G1-T1, P2-G1-T2 (U-07), P4-G1-T1, P5-G1-T1.

### 2026-10-20 | merge window 6 | develop before 72ab442 (PR #23), after this PR
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #26 p4/g2-hashing | p4 | merged (by v1k111-29, 20 Oct 16:39 UTC) | 932bf76 | py 62/13s/4x (tested together with #30 before merging) |
| #28 p2/g1-rules | p2 | merged (by v1k111-29, 20 Oct 16:39 UTC) | 8115921 | cc 28 passed, typecheck clean |
| #30 p2/g1-deploy | p2 | merged (by v1k111-29, 20 Oct 16:39 UTC); stacked on #28, adds log lines only | 5e1a0f7 | as #28 |
| #24 p4/g0-report | p4 | merged through this PR (p1/g1-merge-logs, D-25) | this PR | docs/logs/p4.md only |
| #25 p4/g1-seed-generator | p4 | merged through this PR (D-25) | this PR | py 64/13s/4x (+2 seed tests) |
| #27 p2/g0-report | p2 | merged through this PR (D-25) | this PR | docs/logs/p2.md only |
- After #26, #28 and #30, PRs #24, #25 and #27 conflicted only in the owner's own log
  (`docs/logs/p4.md`, `docs/logs/p2.md`): each PR appends a session entry at the same place.
  The lead resolved them on p1/g1-merge-logs instead of waiting for the owners to rebase (D-25).
  CNF-p1-24, CNF-p1-25, CNF-p1-27: kept both sides word for word, oldest entry first ("newest
  last"). Diff vs develop in the two logs is additions only: p4.md +40 (#24 29 + #25 11), p2.md +56
  (#27). One follow-up commit put p4's 12:50 entry after its 12:27 entry. No code file conflicted.
- `bash scripts/check_all.sh` on p1/g1-merge-logs: "all suites green". py 64/13s/4x / cc 28 /
  gw 17+5todo / fe 2+9todo. PROMPTS.md now gives these develop counts next to the G0 counts.
- Review notes (none blocking): #26 also adds the routes, the gateway client and G3's `assess`
  (scope beyond its title). In #26, an OUTCOME_UNKNOWN create counts as success when the record
  exists, even if an earlier transaction created it (the receipt's `tx_id` may then be wrong).
  CCR-p4-1 (whitespace-only identifiers) and CCR-p4-2 (`GatewayResult.payload` validation) still
  need the lead's answer.
- Open for the lead: REQ-p2-1 (close U-07 in UNKNOWNS.md with p2's 15:55 evidence), REQ-p4-1
  (`check_all.sh` must fail when `uv` is missing), CCR-p4-1, CCR-p4-2. p2 and p4: rebase on develop
  after this PR; your log on develop now holds all your entries.
- Gate status: G0 reports now in from all five (p4: NOT-YET pending CCR-p4-1/2). G1: P2-G1-T1,
  P2-G1-T2 (U-07 evidence), P4-G1-T1 done; still open P1-G1-T2 (U-01), P5-G1-T1, U-07 close.

### 2026-10-21 | merge window 7 | develop before 5badc1b, after d093bb3
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #32 p1/g1-close-gates | p1 | merged (by v1k111-29, 21 Oct 16:14 UTC) | b60e0c6 | docs and scripts/check_all.sh only |
| #33 p3/g1-macos-compose | p3 | merged (by v1k111-29, 21 Oct 16:15 UTC) | f5f5ece | network/README.md and p3 log only |
| #34 p3/g2-submit-route | p3 | merged (by v1k111-29, 21 Oct 16:15 UTC) | 28e86cb | gw 54 passed, 0 todo |
| #36 p5/g1-ui-shell | p5 | merged (by v1k111-29, 21 Oct 16:17 UTC) | d093bb3 | fe 6 passed, 9 todo |
- All four PRs had green CI. This log PR ran `bash scripts/check_all.sh` on develop d093bb3:
  "all suites green". py 64/13s/4x / cc 28 / gw 54 passed, 0 todo / fe 6 passed, 9 todo.
  Gateway went from 17+5todo to 54 with #34 (the 5 todo specs now real tests, plus route and
  error-mapping tests on a fake ledger). Frontend went from 2 to 6 passed with #36 (App render
  tests for the four views); the 9 todo are still `test/api.spec.test.ts`. PROMPTS.md updated.
- Review note: #34 carried a merge commit from develop (0254432, "Merge branch 'develop' into
  p3/g2-submit-route"). AGENTS.md section 3 says to rebase instead. It only brought develop's own
  commits, so it was merged as is. Open PR #35 (p3/g2-ledger) has the same kind of commit (d9a2d3c);
  p3 to rebase it before merge.
- Not merged: #35 p3/g2-ledger (open, waits for p3's rebase and CI). p2/g2-chaincode (P2-G2-T1)
  has no open PR: #29 is closed and the branch is 27 commits behind develop; p3's live `/submit`
  (DEP-p3-2) waits on it.
- Open for the lead: REQ-p3-7 (ISS-p3-9 is the D-23 revisit trigger: YugabyteDB tserver deaths
  during host sleep led to expired-transaction writes and a committing-peer panic on Org2).
- Gate status: **G1 declared.** Every item of the G1 "done when" row in IMPLEMENTATION_PLAN.md 1.3
  is met: contracts-v1.0.0 tagged; Drunix network up on the host (P3-G1-T1..T3); stub chaincode
  deployed (P2-G1-T2); U-02 to U-05 and U-07 answered. All G1 task rows are done except
  P1-G1-T2 (U-01), which is carried forward and does not block G2 work. G0 is still not declared:
  p4's report is NOT-YET until REQ-p1-37 (D-26) lands, and the push test (DEP-p1-3) has not run.

### 2026-10-22 | addendum to merge window 7 | develop before 10cbc8f
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #35 p3/g2-ledger | p3 | merged (by v1k111-29, 21 Oct 16:29:06 UTC, 18 s before #37) | before 10cbc8f | gw 73 passed, 0 todo |
| #37 p1/g1-merge-window-7 | p1 | merged (by v1k111-29, 21 Oct 16:29 UTC) | 10cbc8f | docs only |
- Correction to the merge window 7 entry: it says #35 is open and asks p3 to rebase it. Both are
  wrong; #35 was merged while #37 was in review. Its merge commit from develop (d9a2d3c) is now on
  develop, like 0254432 from #34. ISS-p1-20 stays as the record; REQ-p1-38 is withdrawn.
- This PR ran `bash scripts/check_all.sh` on develop 10cbc8f: "all suites green". py 64/13s/4x /
  cc 28 / gw 73 passed, 0 todo / fe 6 passed, 9 todo. Gateway went from 54 to 73 with #35 (19
  FabricLedger tests). PROMPTS.md updated.
- REQ-p3-7 answered by D-27: D-23 stands, with p3's health check and a rebuild-before-live rule.
- REQ-p1-39 (p2: rebase p2/g2-chaincode, open a new PR for P2-G2-T1) sent as issue #38.
- Gate status: G1 declared (unchanged). G2 work is open; it waits on P2-G2-T1 (issue #38) for the
  live `/submit` call (DEP-p3-2). G0 still not declared (REQ-p1-37, DEP-p1-3).

### 2026-10-22 | G0 note: develop is not protected on GitHub | develop at 0617d68
- ISS-p1-21: GitHub does not protect `develop`. The repo is private on the lead's free personal
  account (`private=true`, owner type User). `GET /repos/v1k111-29/drunix-hackathon/rulesets` and
  `GET .../branches/develop/protection` return 403 "Upgrade to GitHub Pro or make this repository
  public to enable this feature."; `GET .../branches/develop` reports `protected=false`. D-16 kept the
  repo public so that the `protect-develop` ruleset (merge window 1 entry, 18 Oct 15:05) would apply; that ruleset
  is no longer enforced. A push that skips the pre-push hook would land on `develop`.
- D-28: G0's push test is hook-only. Sent to p5 as issue #41 (DEP-p1-3), with `--no-verify`
  forbidden and an instruction to stop and report at once if a push is accepted.
- Other G0 item: REQ-p1-37 sent to p4 as issue #40 (D-26 checks, then G0: YES).
- Gate status: G0 not declared; waits for #40 (p4) and #41 (p5). G1 declared (unchanged).

### 2026-10-22 | merge window 8 | develop before 0617d68, after ec7226f
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #39 p1/g2-window-7-followup | p1 | merged (22 Oct 09:53) | 0617d68 | docs only |
| #42 p1/g1-d28-push-test | p1 | merged (22 Oct 10:22) | b596012 | docs only |
| #43 p1/g1-u01-portal | p1 | merged (22 Oct 14:15) | ed82e88 | docs only |
| #47 p1/g1-close-u01 | p1 | merged (22 Oct 14:20) | 10dddf7 | docs only |
| #48 p4/g3-metrics | p4 | merged (22 Oct 14:36) | ec7226f | py 74 passed, 13 skipped |
- #48 is P4-G3-T2: `GET /metrics` and `GET /records` (with assessment per record), the three
  metrics in `domain/metrics.py`, and the four metrics specs un-marked. It changes only p4's
  files. No contract or generated-file change.
- This PR ran `bash scripts/check_all.sh` on develop ec7226f: "all suites green". py 74 passed /
  13 skipped / 0 xfailed, cc 28 passed, gw 73 passed, fe 6 passed / 9 todo. Python went from 64
  passed / 4 xfailed to 74 passed / 0 xfailed with p4's assessment and metrics work.
- REQ-p4-2 (from p4's log): p2's `ListRecords` is still `NotImplemented`; `/metrics` and
  `/records` are tested against the gateway fake only. Real-network use waits on P2-G3-T1.
- Not merged: p2/g2-chaincode (P2-G2-T1, issue #38) has no new PR. Issues #40 (p4), #41 (p5) and
  #44 (p5) are open.
- Gate status: G1 declared (unchanged). G0 not declared (#40, #41). G2 open; waits on #38.

### 2026-10-24 | addendum to merge window 8 | develop at 2cfa87e
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #49 p4/g2-d26-validation | p4 | merged (by v1k111-29, 23 Oct 05:58:04 UTC) | 1c83b2f | not rerun by the lead; p4.md 2026-10-22 10:10: py 78 passed / 13 skipped / 4 xfailed |
| #50 p3/g3-endorsement | p3 | merged (by v1k111-29, 23 Oct 05:58:09 UTC) | 69b6396 | not rerun by the lead; p3.md 2026-10-22 20:22 |
| #51 p2/g2-chaincode | p2 | merged (by v1k111-29, 23 Oct 05:58:14 UTC) | a4ff3bd | not rerun by the lead; p2.md: cc 45 passed |
| #52 p2/g3-list-records | p2 | merged (by v1k111-29, 23 Oct 05:58:19 UTC) | 1d2b34b | not rerun by the lead; p2.md: cc 70 passed |
| #53 p1/g2-merge-window-8 | p1 | merged (by v1k111-29, 23 Oct 05:58:24 UTC) | 2cfa87e | docs only |
- Source: `gh pr view <n> --json mergedAt,author,mergedBy` on 24 Oct 2026. All five were merged
  within 20 seconds of each other; this addendum is written after the fact. The lead did not run
  `bash scripts/check_all.sh` on the individual merge commits, so no suite counts are recorded
  here that were not measured; the counts in the last column are the authors' own.
- Corrections to the merge window 8 entry (2026-10-22): it says p2/g2-chaincode (issue #38) has no
  new PR, and lists issues #40 and #41 as open. Now: #38 and #40 are CLOSED (23 Oct 05:58:15 and
  05:58:47 UTC; `gh issue view`), #51 carries P2-G2-T1, #49 carries REQ-p1-37 (D-26). It also
  says `ListRecords` is `NotImplemented` (REQ-p4-2); #52 implements it (P2-G3-T1). Issues #41
  (push test) and #44 (P5-G2-T1) are still open.
- Evidence from #51: p2 deployed the chaincode on a Drunix network and made live calls (p2.md
  2026-10-23 00:42). U-12 is closed from it (docs/UNKNOWNS.md); U-09 closed as well.
- Open PRs, both from p5 and both MERGEABLE per `gh pr view`:
  - #54 p5/g2-api (P5-G2-T1). Changes `frontend/src/api.ts`, `frontend/src/App.tsx`,
    `frontend/test/api.spec.test.ts`, `docs/logs/p5.md` and `docs/logs/INTEGRATION_LOG.md`. It
    overlaps the lead's override commit 94b39fb on p1/all-roles-finish in the first three files
    and will conflict when both land. It also appends a "G0 push-hook test" entry to this log,
    which is lead-only (AGENTS.md section 2); that entry will conflict with this one at the end of
    the file. The lead decides which frontend version stays and moves p5's note into p5.md.
  - #55 p5/g0-push-test (DEP-p1-3). Changes `docs/logs/p5.md` only. Its log (p5.md 2026-10-23
    22:30) reports the pre-push hook rejecting a push to `develop` of a local bare repository
    (PASS), and keeps p5's 22 Oct test against `origin` as INCONCLUSIVE. D-28 asks for
    `git push origin HEAD:develop`, so the lead decides whether the local variant satisfies G0.
- Override: on 24 Oct 2026 the user told the lead in chat to ignore AGENTS.md ownership and finish
  the remaining tasks. The lead did the open p4 and p5 tasks on branch p1/all-roles-finish
  (commits 94b39fb P5-G2/G3 frontend, 84109c0 P4-G3-T3 seed command, 862ee7b demo.sh and logs;
  branch is 3 commits above develop 2cfa87e). It is not pushed and has no PR yet. The work is
  recorded in docs/logs/p4.md, p5.md and p1.md under 2026-10-24. p5 should review it (p5.md).
- Gate status:
  - G1 declared (merge window 7), unchanged.
  - G0 not declared: waits for issue #41 and PR #55 (push test, DEP-p1-3). p4's report is YES.
  - G2 and G3 wait on a live run on the Drunix host: the `needs_g2` / `needs_g3` markers in
    `tests/integration/test_live_network.py` come off only when the tests pass with `S14_LIVE=1`
    (D-12). The lead's machine has no Docker and no Drunix network. Chaincode is deployed and
    answered live calls on p2's machine (p2.md 2026-10-23 00:42), which is not the integration
    suite.
  - G4 waits on a run of `bash scripts/demo.sh` (written, syntax-checked with `bash -n`, never run)
    and then the `v1.0.0` tag (P1-G4-T2).
- Counts: on the working tree of p1/all-roles-finish the lead measured `uv run pytest -q` on
  24 Oct 2026: 91 passed, 14 skipped, 1 warning; `npm test` in frontend/: 19 passed. These
  include uncommitted changes and are not counts of develop 2cfa87e. `check_all.sh` was not run
  for this entry.

### 2026-10-24 | rulings for G0 and PR #54 | develop at 2cfa87e
- D-30 (amends D-28): p5's local bare-repo push test (PR #55) counts as G0's push test. Once #55
  is merged, G0's last item (DEP-p1-3, issue #41) is met. All five G0 reports already say YES.
  So G0 is declared when #55 merges.
- D-31: PR #54 is superseded by PR #56. p5's #54 log entries are copied into `docs/logs/p5.md` on
  #56 (CNF-p1-54 resolved that way); #54 to be closed with a pointer to D-31.
- The lead's merge of #55 from this session was refused by the tool's permission check
  ("Merge Without Review"). #55, #56 and the closing of #54 wait for the lead to do by hand.

### 2026-10-25 | merge window 9 | develop before 2cfa87e, after 22eb128
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #55 p5/g0-push-test | p5 | merged (25 Oct 00:25 UTC) | 96210fb | docs/logs/p5.md only |
| #56 p1/all-roles-finish | p1 | merged (25 Oct 00:30 UTC), rebased on 96210fb first | 22eb128 | py 91 passed / 14 skipped, cc 70, gw 73, fe 19 |
| #54 p5/g2-api | p5 | closed, superseded by #56 (D-31), comment on the PR | n/a | n/a |
- #56 was rebased on develop after #55. `docs/logs/p5.md` conflicted twice, both times between
  p5's own entries and the lead's (CNF-p1-56). Resolved by keeping every entry word for word,
  oldest first: #54's 22 Oct and 23 Oct 21:58 entries, then #55's 23 Oct 22:30 entry, then the
  24 Oct entry.
- `bash scripts/check_all.sh` ran on the rebased branch at ceaef52: "all suites green". py 91 passed /
  14 skipped, cc 70 passed, gw 73 passed, fe 19 passed. CI on #56 passed 5 of 5 checks.
  `git diff origin/develop ceaef52` is empty, so develop 22eb128 has the same tree. The counts in
  PROMPTS.md (branch paragraph) are now the develop counts.
- GitHub auto-merge is disabled for the repo, so each PR was merged by hand after green CI.
- Still open on GitHub, to be closed by the lead by hand: issue #41 (met by #55 and D-30) and issue
  #44 (met by #56, D-31). The session tool refused to close them without a direct request.
- **Gate status: G0 declared.** All five G0 reports say YES (p1, p2, p3, p4 at p4.md 22 Oct 10:10,
  p5), and the push test passes under D-30 (#55). G1 declared (unchanged). G2 and G3 are open: the
  `S14_LIVE=1` suite has not run since #51 and #52, and E3 still needs the endorsement negative
  test on `receiptbook` (DEP-p3-3). G4 is open: `scripts/demo.sh` has not run on the host, and
  there is no `v1.0.0` tag. The lead's machine has no Docker or WSL, so none of these can run there.

### 2026-10-25 | merge window 10 | develop before 22eb128, after 024a671
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #57 p1/g4-hardening | p1 | merged (25 Oct 00:47 UTC) after 5/5 green CI | 024a671 | py 122 passed / 14 skipped, cc 70, gw 73, fe 21 |
- #57: bounded MVCC_CONFLICT retry and HealthResponse (p4 files), test typecheck in gateway and
  chaincode (p3, p2), the `/api` proxy for `vite preview` and E8 tests (p5), U-06 and U-08 paper
  halves, D-32, and docs/HOST_RUNBOOK.md. All of it was done by the lead under the user's override.
  A review before merge found one real bug: a create that hit MVCC_CONFLICT before OUTCOME_UNKNOWN
  could be falsely confirmed by read-back. It was fixed in a86606f.
- `bash scripts/check_all.sh` on develop 024a671 (detached checkout): "all suites green", with the
  counts above.
- **Tags:** `g0` on 024a671 (G0 declared in merge window 9; gate-close entry merged with #57) and
  `g1` on d093bb3, the SHA verified when G1 was declared (merge window 7, 21 Oct). Neither tag
  existed before, although G1 was declared on 21 Oct. Both follow docs/GIT_WORKFLOW.md "Gate close".
- Gate status: G0 and G1 closed and tagged. G2, G3 and G4 are open; the steps to close them are in
  docs/HOST_RUNBOOK.md and need the Drunix host machine.
- Still open on GitHub (lead to close by hand): issue #41 (met, D-30) and #44 (met, D-31).

### 2026-10-26 | merge window 11 | develop before e9b08b9, after 297f5a4
| PR | Author | Result | develop after | Suites after merge |
|---|---|---|---|---|
| #59 p1/g2-live-ci | p1 (+ p2, p3, p4, p5 work under the user's override) | merged 26 Oct by the lead's session, with the user's explicit approval in chat; all 6 checks green, including the live job (run 40224514667) | 297f5a4 | py 122 passed / 15 skipped, cc 78, gw 73, fe 21 |
- `bash scripts/check_all.sh` on develop 297f5a4: "all suites green", with the counts above. ci.yml on the push to develop: success.
- `live.yml` dispatched on develop 297f5a4, run 40278900530: **failure**.
  - The live suite passed: 14 passed, 1 skipped.
  - E3 passed: the one-org write gave ENDORSEMENT_POLICY_FAILURE on both cp peers, and the two-org write was VALID.
  - The demo seed stopped at `loaded 29/30`. SYNTHETIC-SB-0018's CUSTOMS_STATUS_OBSERVED failed with "500 INTERNAL ProposalResponsePayloads do not match". The UI smoke test did not run, because the seed is strict in headless mode.
  - ISS-p1-25: lp1.org2's log shows "read value mismatch ... initial-endorser-value=78 invoked-endorser-value=79" on that record's key. A write through Org1 two seconds earlier had committed on Org1's state but not yet on Org2's, so the two endorsements differed. Nothing reached the orderer. This is intermittent: five earlier runs (40219044536 to 40224514667) did not hit it. It is assigned to p3 as a bounded endorse retry in the gateway (no contract change).
- **Gate status:** G2, G3 and G4 are **not declared** on 297f5a4, and no tags were made. 297f5a4 does not have a green live run, and G2's UI round-trip has no evidence on it. The gates wait for the ISS-p1-25 fix and a green `live.yml` run on the develop merge commit.
