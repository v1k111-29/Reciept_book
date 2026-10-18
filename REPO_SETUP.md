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

Put the repo in a GitHub **organization** and make the lead an admin of it (D-14). A repo
owned by a personal account gives collaborators no admin role and no "restrict who can push",
so the lead could not apply step 3 or bypass it. Branch protection and rulesets on a
**private** repo need a paid plan (Team for an org) [I, U-09: check in your settings screen];
a public repo does not.

## 3. Protect `main` and `develop` (GitHub → Settings → Rules → Rulesets)

One ruleset per branch. For **both** branches:
- Enforcement: Active.
- Bypass list: the lead only (the "Repository admin" role, or a team that holds only the
  lead), mode **"For pull requests only"** (D-14). The lead then merges by PR without a
  second approval but can never push directly.
- Require a pull request before merging, with **1 approval**. Turn on **review from Code
  Owners** only after step 1 has real usernames in `.github/CODEOWNERS` (D-15).
- Require status checks to pass: `branch-rules`, `python`, `node (chaincode)`, `node (gateway)`, `node (frontend)`.
  GitHub lists a check only after it has run; `branch-rules` runs only on a pull request
  into `develop` or `main`, so open one PR first.
- Block force pushes and restrict deletions.
- Optional: "Restrict updates", so only the bypass list (the lead) can merge.

For `main`, also: allow merging only from `develop`. GitHub has no setting for this; the
required `branch-rules` CI job fails any PR into `main` whose source isn't `develop`.

Bypass skips every rule in the ruleset, required checks included, so the lead checks CI is
green before merging (`docs/GIT_WORKFLOW.md`).

## 4. Invite the team

Give p2-p5 **Write** access, so they can push their own branches and open PRs. The
rulesets stop them writing to `main`/`develop`.

## 5. Check it works

Ask one member to try `git push origin HEAD:develop` from a clone. Two things should
reject it: their pre-push hook first, then GitHub. Record the result in
`docs/logs/INTEGRATION_LOG.md` under G0.
