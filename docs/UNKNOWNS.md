# UNKNOWNS.md (owner: p1; each item has an owner who closes it with evidence)

Rule: nobody codes as if an unknown were known. Close an item by writing the evidence
(command + output, or source link + quote) and the date, then mark it CLOSED.

| ID | Unknown | Why it matters | Owner | Close by | How to close | Status |
|---|---|---|---|---|---|---|
| U-01 | Hackathon timeline, our challenge code, judging criteria, prototype requirement, official FAQ | Gate dates; whether "admit a database baseline" is acceptable. Project Axis's repo says pitch 25 Oct, prototype 10-22 Nov [S] | p1 | G1 | ask the organisers (India Blockchain Forum, per Project Axis's README); get the FAQ | OPEN |
| U-02 | Which Drunix peer serves the Fabric Gateway API (lite or committing), and does `@hyperledger/fabric-gateway` 1.13 work with it | The whole gateway design (D-04) | p3 | G1 | connect from the gateway to each peer; log the result | OPEN |
| U-03 | Does Drunix `network.sh deployCC` accept `-ccep` (endorsement policy) and `-ccl typescript` | E3 and deployment | p3 | G1 | read `network.sh` / run it; log | OPEN |
| U-04 | Can the state DB be something other than YugabyteDB (issue #8: non-atomic SQL + Redis writes) | Reliability of commits | p3 | G1 | try the `-s` options; log | OPEN |
| U-05 | Does a custom channel name (`receiptbook`) work, or only `mychannel` | Scripts and config | p3 | G1 | `network/up.sh`; log | OPEN |
| U-06 | Can a third org be added to the test network (Fabric's `addOrg3` equivalent) | N2, N3 | p3 | after G3 | inspect the test-network folder | OPEN |
| U-07 | Does TypeScript chaincode build and run on Drunix in practice (only Go samples were seen in the repo) | D-02 | p2 + p3 | G1 | deploy the stub chaincode; log | OPEN |
| U-08 | Private data collections on Drunix: the docs mention a KeyDB transient store, but "private data collections" was not on the pages read; the test network has an `asset-transfer-private-data` example | N1 | p2 | after G3 | deploy the sample with `-cccg`; log | OPEN |
| U-09 | GitHub Actions versions (`actions/checkout@v4`, `actions/setup-node@v4`, `astral-sh/setup-uv@v5`) and which push restrictions our repo plan offers | CI and branch protection | p1 | G0 | first CI run; settings screen | OPEN |
| U-10 | Which team member is the lead, and is the lead p1 | D-10 | user | G0 | user confirms | OPEN |
| U-11 | Which machine(s) can host Drunix (Linux/WSL2, Docker, RAM for YugabyteDB) | G1 feasibility | p3 + all | G0 | the G0 reports | OPEN |
| U-12 | What the ledger timestamp proves. In Fabric the transaction timestamp comes from the client's proposal [I, verify]; then `ledger_time` shows when a signed record was submitted, not when the real-world step happened | Honest wording in the pitch and UI | p2 | G2 | Fabric/Drunix docs + test; log | OPEN |
