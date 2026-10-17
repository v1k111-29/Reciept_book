## What this PR does
<!-- one or two sentences; link the task ID from IMPLEMENTATION_PLAN.md Part 3, e.g. P4-G2-T1 -->

## Owner and branch
- Author id: p<N>
- Branch: p<N>/<gate>-<topic>  ->  develop

## Checklist (all must be true; the lead will not merge otherwise)
- [ ] I only changed files I own (CODEOWNERS / IMPLEMENTATION_PLAN.md Part 2)
- [ ] Rebased on the latest `develop`; no merge commits from other people's branches
- [ ] `bash scripts/check_all.sh` is green on my machine (paste the summary line below)
- [ ] I removed the xfail / `.fails` marker from every spec test I made pass
- [ ] No change to contracts.py or `*/src/generated/` (or: this is P1's contract PR)
- [ ] My log `docs/logs/p<N>.md` has this session's entry, including any issues, conflicts or missing dependencies

## Test summary
```
<paste counts: python passed/xfailed, chaincode, gateway, frontend>
```

## Known issues / follow-ups
<!-- anything that doesn't match develop, or that someone else must do -->
