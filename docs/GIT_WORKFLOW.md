# Git workflow (owner: p1)

## Branches

| Branch | Who writes | How |
|---|---|---|
| `main` | **lead only** | merge of `develop` at a gate close, tagged (`g0`, `g1`, …, `v1.0.0`) |
| `develop` | **lead only** | merging reviewed PRs from `p<n>/…` branches |
| `integration/<topic>` | lead only | short-lived: the lead tries a combination before merging |
| `p<n>/g<gate>-<topic>` | **only person p<n>** | your work, e.g. `p4/g2-hashing` |

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
**GitHub branch protection is the real enforcement** (`REPO_SETUP.md`); the hook is a
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

```bash
git checkout develop && git pull
# for each PR in order p1 → p2 → p3 → p4 → p5 → p1:
#   check the PR checklist and CODEOWNERS approvals, and that CI is green
#   merge with "Create a merge commit" (keeps each person's history together)
git pull && bash scripts/check_all.sh   # after EACH merge
# red?  git revert -m 1 <merge-sha> && git push  ; log it ; tell the owner
```

Then append the window's results to `docs/logs/INTEGRATION_LOG.md`.

## Gate close (lead)

```bash
git checkout develop && git pull && bash scripts/check_all.sh
git checkout main && git pull && git merge --no-ff develop -m "Gate G<k> close"
git tag g<k> && git push origin main --tags
```

## Never

- `git push --no-verify`, `git push -f` to `main`/`develop`, `git push --mirror`
- merge `develop` into your branch (rebase instead)
- commit secrets, keys, certs, salts, `network/env.sh`, `organizations/`
- commit another package's lockfile
