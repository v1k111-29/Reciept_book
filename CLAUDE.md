@AGENTS.md

## Claude Code only

- AGENTS.md above is the shared rulebook for Claude Code and Codex. Its rules win over
  anything below.
- At session start, run `/context` once and confirm both `CLAUDE.md` and `AGENTS.md` appear
  under memory files. If AGENTS.md is missing, stop and tell the person driving you.
- Keep personal, uncommitted preferences in `CLAUDE.local.md` (gitignored). Do not put
  project rules there.
- Use plan mode for any change touching more than three files, or any file under
  `chaincode/src/` or `gateway/src/`.
- Never edit `.github/`, `scripts/` or `*/src/generated/` unless your `s14.id` is `p1`.
