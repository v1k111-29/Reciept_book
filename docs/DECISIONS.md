# DECISIONS.md (owner: p1; append-only, newest last)

Format: `D-<n> | date | decision | who decided | why / source | revisit if`

| ID | Date | Decision | Decided by | Why / source | Revisit if |
|---|---|---|---|---|---|
| D-01 | 15-16 Oct 2026 | Build S14 v3: a shared milestone record per shipping bill (`docs/PROBLEM.md`) | team | Team choice after the AI debate (INCONCLUSIVE-AUDIT); v3 is an un-debated revision | organisers' criteria (U-01) |
| D-02 | 16 Oct 2026 | Stack: Python FastAPI backend + React/TypeScript frontend + TypeScript chaincode | user | Matches the team's uv/npm template; one language beyond Python | TS chaincode fails on Drunix (U-07) |
| D-03 | 16 Oct 2026 | Use the real Drunix test network from the start; in-memory fakes only as test doubles | user | "Drunix must be used"; credibility | host machine not available (U-11) |
| D-04 | 16 Oct 2026 | A thin TypeScript gateway (Fabric Gateway SDK) sits between Python and Drunix | lead + AI proposal | Fabric Gateway clients exist for Go/Node/Java; no maintained Python one to our knowledge [I]; Project Axis does the same [S] | U-02 shows another route |
| D-05 | 16 Oct 2026 | Endorsement policy AND(Org1, Org2) for every write | AI proposal, lead to confirm | Both parties sign each milestone (`docs/PROBLEM.md` 6.3, 6.7) | Drunix flags (U-03) |
| D-06 | 16 Oct 2026 | Org1MSP = AD bank, Org2MSP = exporters' body (`DEFAULT_MSP_ROLES`) | AI proposal | Test network has two orgs | N2 adds a third |
| D-07 | 16 Oct 2026 | Only salted SHA-256 hashes of SB/IRM/eBRC numbers go on the ledger; salt in env | AI proposal | Privacy; FEATURES E9 | n/a |
| D-08 | 16 Oct 2026 | One contract source: `contracts.py` → `contracts.schema.json` → `contracts.ts` → `src/generated/`, all owned by p1, with parity tests | AI proposal | Stops Python/TS drift; one owner avoids conflicts | n/a |
| D-09 | 16 Oct 2026 | The team lead is the only integrator and the only one who touches `main`/`develop`; everyone else works on `p<n>/…` branches | user | Avoid conflicts and accidental pushes | n/a |
| D-10 | 16 Oct 2026 | Lead = p1 (`scripts/team.conf`) | AI default, **user to confirm** (U-10) | The user's answer named the lead but not which id | user says otherwise |
| D-11 | 16 Oct 2026 | One log file per person + lead-only INTEGRATION_LOG | AI proposal | Shared log files would conflict on every merge | n/a |
| D-12 | 16 Oct 2026 | Spec tests are strict xfail (Python) / `it.fails` / `it.todo` (TS); remove the marker when implemented | AI proposal | Suites green at G0 while specs define "done"; forgetting to un-mark turns red | n/a |
| D-13 | 16 Oct 2026 | Added `MilestoneRequest` (raw reference) and `TxReceipt` to contracts 0.1.0 | AI, while writing Part 2 | The frontend can't hash: the salt is server-side | G0 review |
