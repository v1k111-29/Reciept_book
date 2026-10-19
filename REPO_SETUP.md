# REPO_SETUP.md: the lead's one-time setup (owner: p1)

Do this once, before anyone runs the G0 kickoff prompt.

## 1. Fill the placeholders

- `.github/CODEOWNERS`: filled (p1 `@v1k111-29`, p2 `@stitussamuel07-code`, p3 `@vishalbala-nps`, p4 `@raghavvenkatraman`, p5 `@sathvik-111`). Send Write invites to p2 and p5 (step 4).
- `scripts/team.conf`: `LEAD_ID=p1` (change only if your lead uses another id).
- `docs/logs/README.md`: fill the id → name table.

## 2. Create the repo and the long-lived branch

```bash
cd s14-receipt-book
git init -b main
git config s14.id p1 && bash scripts/install-hooks.sh
git add . && git commit -m "P1-G0-T1: scaffold, contracts 0.1.0, docs"
gh repo create <OWNER>/<REPO_NAME> --private --source=. --push   # or create it on github.com and push
git checkout -b develop && git push -u origin develop
```

Then on GitHub: Settings → General → Default branch → `develop`. `develop` is the only
long-lived branch; `main` is retired and stays frozen at the scaffold commit (D-16).

The lead must be an admin of the repo: the owner of a personal-account repo, or an admin in
an organization (D-14, D-16). Collaborators on a personal-account repo get no admin role and
no "restrict who can push". Rulesets on a **private** repo need a paid plan: GitHub's API
answers "Upgrade to GitHub Pro or make this repository public to enable this feature." (U-09).
Our repo is public on the lead's personal account.

## 3. Protect `develop` (GitHub → Settings → Rules → Rulesets)

One branch ruleset, `protect-develop`, target `develop`:
- Enforcement: Active.
- Bypass list: the lead only (the "Repository admin" role, or a team that holds only the
  lead), mode **"For pull requests only"** (D-14). The lead then merges by PR without a
  second approval but can never push directly.
- Require a pull request before merging, with **1 approval**. Turn on **review from Code
  Owners** only after step 1 has real usernames in `.github/CODEOWNERS` (D-15).
- Require status checks to pass: `branch-rules`, `python`, `node (chaincode)`, `node (gateway)`, `node (frontend)`.
  GitHub lists a check only after it has run; `branch-rules` runs only on a pull request
  into `develop`, so open one PR first.
- Block force pushes and restrict deletions.
- Merge method: merge commits only.
- Optional: "Restrict updates", so only the bypass list (the lead) can merge.

No ruleset on `main`: it is retired (D-16). Only the pre-push hook guards it.

Bypass skips every rule in the ruleset, required checks included, so the lead checks CI is
green before merging (`docs/GIT_WORKFLOW.md`).

## 4. Invite the team

Give p2-p5 **Write** access, so they can push their own branches and open PRs. The
ruleset stops them writing to `develop`.

## 5. Check it works

Ask one member to try `git push origin HEAD:develop` from a clone. Two things should
reject it: their pre-push hook first, then GitHub. Record the result in
`docs/logs/INTEGRATION_LOG.md` under G0.
