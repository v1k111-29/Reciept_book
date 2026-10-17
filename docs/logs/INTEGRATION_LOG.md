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
