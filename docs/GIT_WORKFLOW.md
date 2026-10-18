# Git workflow (owner: p1)

## Branches

| Branch | Who writes | How |
|---|---|---|
| `develop` | **lead only** | the only long-lived branch and the default branch (D-16): merging reviewed PRs from `p<n>/…` branches; gate tags (`g0`, `g1`, …, `v1.0.0`) go on it |
| `integration/<topic>` | lead only | short-lived: the lead tries a combination before merging |
| `p<n>/g<gate>-<topic>` | **only person p<n>** | your work, e.g. `p4/g2-hashing` |

`main` is retired (D-16). It stays frozen at the first scaffold commit; nobody pushes to it,
merges into it or opens a PR into it. The pre-push hook still blocks pushes to it.

One branch per task (or small group of tasks in the same gate). Keep PRs under ~400 lines.

## One-time setup per clone

```bash
git clone <REPO_URL> && cd <REPO_NAME>
git config s14.id p<N>            # your id, e.g. p3; ask the lead if unsure
bash scripts/install-hooks.sh     # installs the pre-push guard
git checkout develop
```

The pre-push guard blocks: pushing to `main`/`develop`/`integration/*` or pushing tags
(unless you are the lead), pushing to a branch that doesn't start with your id, deleting
`main`/`develop`, and force-pushing `main`/`develop`. It was tested before shipping.
**The GitHub ruleset on `develop` is the real enforcement** (`REPO_SETUP.md`); the hook is a
seatbelt.

## Daily cycle

```bash
git fetch origin
git checkout p<N>/g2-topic                  # or: git checkout -b p<N>/g2-topic origin/develop
git rebase origin/develop                   # stay current: rebase, never merge develop in
# ... work, commit small and often ...
bash scripts/check_all.sh                   # everything green before pushing
git push --force-with-lease origin p<N>/g2-topic   # force-with-lease only on your own branch
# open / update PR: base = develop
```

Commit messages: `P4-G2-T1: hash shipping-bill key with server salt`. The task ID comes first.

## Rebase conflicts

1. Conflict only in **files you own**: resolve, run your suite and `check_all.sh`, then
   `git rebase --continue`. Log `CNF-<id>-<n>` with the files and what you kept.
2. Conflict in **any file you don't own**: run `git rebase --abort`, log `CNF-<id>-<n>`, and
   tell the lead. Don't resolve other people's code. Usually it means someone touched a file
   outside their slice, and the lead sorts that out.

## What the lead does in a merge window

`develop` accepts changes **only through pull requests** (ruleset, `REPO_SETUP.md` step 3).
That includes the lead: the lead is on the bypass list "for pull requests only", so the lead
can merge a PR without a second approval but can never push to `develop` directly. Bypass also skips the required checks, so the lead checks CI is green before merging.

```bash
git checkout develop && git pull
# for each PR in order p1 → p2 → p3 → p4 → p5 → p1:
#   check the PR checklist and CODEOWNERS approvals, and that CI is green
#   merge with a merge commit (keeps each person's history together):
gh pr merge <n> --merge                 # add --admin only for the lead's own PRs (bypass)
git pull && bash scripts/check_all.sh   # after EACH merge
```

Red after a merge? Revert through a PR, then stop merging:

```bash
git checkout -b p1/revert-pr<n> origin/develop
git revert -m 1 <merge-sha>
git push -u origin p1/revert-pr<n>
gh pr create --base develop --title "Revert PR <n>: develop red after merge" --body "<log ID>"
gh pr merge --merge --admin             # once CI on the revert PR is green
```

Log it and tell the owner. Then append the window's results to
`docs/logs/INTEGRATION_LOG.md` on a `p1/...` branch and merge that by PR too.

## Gate close (lead)

A gate closes with a tag on `develop`, not a merge (D-16).

```bash
git checkout develop && git pull --ff-only && bash scripts/check_all.sh
git rev-parse HEAD                      # the SHA you verified; note it in the gate-close entry
# merge the gate-close entry for INTEGRATION_LOG.md by PR (p1/... branch), then:
git tag -a g<k> <verified-sha> -m "Gate G<k> close"
git push origin g<k>                    # tags are lead-only (pre-push hook)
```

The tag goes on the SHA you verified, so later merges into `develop` don't move it.
Final release: tag `v1.0.0` the same way at G4.

## Never

- `git push --no-verify`, `git push -f` to `develop`, `git push --mirror`
- push to `develop` directly, even as the lead (use a PR)
- push to, merge into or open a PR into `main` (retired, D-16)
- merge `develop` into your branch (rebase instead)
- commit secrets, keys, certs, salts, `network/env.sh`, `organizations/`
- commit another package's lockfile
