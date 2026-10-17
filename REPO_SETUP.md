# REPO_SETUP.md: the lead's one-time setup (owner: p1)

Do this once, before anyone runs the G0 kickoff prompt.

## 1. Fill the placeholders

- `.github/CODEOWNERS`: replace `@P1_GITHUB` … `@P5_GITHUB` with real GitHub usernames.
- `scripts/team.conf`: `LEAD_ID=p1` (change only if your lead uses another id).
- `docs/logs/README.md`: fill the id → name table.

## 2. Create the repo and the two long-lived branches

```bash
cd s14-receipt-book
git init -b main
git config s14.id p1 && bash scripts/install-hooks.sh
git add . && git commit -m "P1-G0-T1: scaffold, contracts 0.1.0, docs"
gh repo create <OWNER>/<REPO_NAME> --private --source=. --push   # or create it on github.com and push
git checkout -b develop && git push -u origin develop
```

Recommended: create a free GitHub **organization** for the team and put the repo there.
Some push-restriction settings are only offered for organization repos [U-09: check in
your settings screen].

## 3. Protect `main` and `develop` (GitHub → Settings → Branches, or Rules → Rulesets)

For **both** branches:
- Require a pull request before merging, with **1 approval** and **review from Code Owners**.
- Require status checks to pass: `branch-rules`, `python`, `node (chaincode)`, `node (gateway)`, `node (frontend)`.
- Block force pushes and deletions.
- Restrict who can push or merge to the lead, if your plan offers it (U-09).

For `main`, also: allow merging only from `develop`. The `branch-rules` CI job also fails
any PR into `main` whose source isn't `develop`.

## 4. Invite the team

Give p2-p5 **Write** access, so they can push their own branches and open PRs. Branch
protection stops them writing to `main`/`develop`.

## 5. Check it works

Ask one member to try `git push origin HEAD:develop` from a clone. Two things should
reject it: their pre-push hook first, then GitHub. Record the result in
`docs/logs/INTEGRATION_LOG.md` under G0.
