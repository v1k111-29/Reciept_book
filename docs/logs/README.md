# Logs (everything is documented here)

| Id | Name (lead fills in) | Log file |
|---|---|---|
| p1 (lead) | `@v1k111-29` | `p1.md` + `INTEGRATION_LOG.md` (lead only) |
| p2 | _not yet assigned_ | `p2.md` |
| p3 | `@vishalbala-nps` | `p3.md` |
| p4 | `@raghavvenkatraman` | `p4.md` |
| p5 | _not yet assigned_ | `p5.md` |

**Rules:** write only your own file; append, never rewrite history; one entry per session;
log a problem the moment you find it. Give every item an ID so others can refer to it:

| Prefix | Meaning |
|---|---|
| `ISS-<id>-<n>` | issue: something broken or not matching develop or the contract |
| `CNF-<id>-<n>` | merge or rebase conflict (files, what was kept, who was told) |
| `DEP-<id>-<n>` | missing dependency: someone else's work, a library, a tool, a machine |
| `CCR-<id>-<n>` | contract change request (what, why, who is affected) |
| `REQ-<id>-<n>` | request to another owner to change their file |
| `UNK-<U-nn>` | evidence towards closing an UNKNOWNS.md item |

Mark items resolved with `→ RESOLVED <date> <how>`; never delete them.

## Session entry template (copy into your file)

```markdown
### <YYYY-MM-DD HH:MM> | <TASK_ID> | branch <p<n>/...> | rebased on develop <sha>
- Tool: Codex / Claude Code (model if shown)
- Did:
  - ...
- Tests: python <passed/skipped/xfailed> | chaincode <..> | gateway <..> | frontend <..>  (only the suites I ran)
- check_all.sh: green / red (<what>)
- Issues / conflicts / deps / requests:
  - ISS-p<n>-<k>: ...
  - CNF-p<n>-<k>: ...
  - DEP-p<n>-<k>: ...
  - CCR-p<n>-<k>: ...
  - REQ-p<n>-<k>: (to p<m>) ...
- Doesn't match develop / contract: <none or details>
- Next step: ...
```

## G0 report template

```markdown
## G0 report | <YYYY-MM-DD HH:MM>
- On develop at <sha>: yes / no
- s14.id: <id>; hooks installed: yes / no
- Install clean: yes / no (details)
- Suites: python <counts> (expected 32 passed, 13 skipped, 16 xfailed) | <my package> <counts> (expected ...)
- Contract concerns (types I depend on): <none, or a list>
- Machine (p3 especially): OS <...>, docker <...>, go <...>, jq <...>, bash <...>
- **G0: YES / NOT-YET** (because ...)
```
