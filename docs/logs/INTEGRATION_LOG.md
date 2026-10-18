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
