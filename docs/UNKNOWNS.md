# UNKNOWNS.md (owner: p1; each item has an owner who closes it with evidence)

Rule: nobody codes as if an unknown were known. Close an item by writing the evidence
(command + output, or source link + quote) and the date, then mark it CLOSED.

| ID | Unknown | Why it matters | Owner | Close by | How to close | Status |
|---|---|---|---|---|---|---|
| U-01 | Our challenge code, judging criteria, prototype requirement, official FAQ | Whether "admit a database baseline" is acceptable; what the prototype must show | p1 | G1 | ask the organisers (India Blockchain Forum, per Project Axis's README); get the FAQ | OPEN (partial evidence below) |
| U-02 | Which Drunix peer serves the Fabric Gateway API (lite or committing), and does `@hyperledger/fabric-gateway` 1.13 work with it | The whole gateway design (D-04) | p3 | G1 | connect from the gateway to each peer; log the result | CLOSED 18 Oct 2026 (p3; evidence below) |
| U-03 | Does Drunix `network.sh deployCC` accept `-ccep` (endorsement policy) and `-ccl typescript` | E3 and deployment | p3 | G1 | read `network.sh` / run it; log | CLOSED 18 Oct 2026 (p3; TypeScript needs the ISS-p3-8 workaround; evidence below) |
| U-04 | Can the state DB be something other than YugabyteDB (issue #8: non-atomic SQL + Redis writes) | Reliability of commits | p3 | G1 | try the `-s` options; log | SETTLED BY DECISION 18 Oct 2026 (D-23: keep YugabyteDB); other state DBs untested |
| U-05 | Does a custom channel name (`receiptbook`) work, or only `mychannel` | Scripts and config | p3 | G1 | `network/up.sh`; log | CLOSED 18 Oct 2026 (p3; evidence below) |
| U-06 | Can a third org be added to the test network (Fabric's `addOrg3` equivalent) | N2, N3 | p3 | after G3 | inspect the test-network folder | OPEN |
| U-07 | Does TypeScript chaincode build and run on Drunix in practice (only Go samples were seen in the repo) | D-02 | p2 + p3 | G1 | deploy the stub chaincode; log | OPEN (evidence from p3 below; closes when p2 deploys our stub, P2-G1-T2) |
| U-08 | Private data collections on Drunix: the docs mention a KeyDB transient store, but "private data collections" was not on the pages read; the test network has an `asset-transfer-private-data` example | N1 | p2 | after G3 | deploy the sample with `-cccg`; log | OPEN |
| U-09 | GitHub Actions versions (`actions/checkout@v4`, `actions/setup-node@v4`, `astral-sh/setup-uv@v5`) and which push restrictions our repo plan offers | CI and branch protection | p1 | G0 | first CI run; settings screen | OPEN |
| U-10 | Which team member is the lead, and is the lead p1 | D-10 | user | G0 | user confirms | OPEN |
| U-11 | Which machine(s) can host Drunix (Linux/WSL2, Docker, RAM for YugabyteDB) | G1 feasibility | p3 + all | G0 | the G0 reports | CLOSED 18 Oct 2026 (p3's MacBook is the host machine; evidence below) |
| U-12 | What the ledger timestamp proves. In Fabric the transaction timestamp comes from the client's proposal [I, verify]; then `ledger_time` shows when a signed record was submitted, not when the real-world step happened | Honest wording in the pitch and UI | p2 | G2 | Fabric/Drunix docs + test; log | OPEN |

## Evidence

### U-01 (p1, 18 Oct 2026): partial, still OPEN

Public web search only. Our challenge code, judging criteria and the
FAQ were **not** found on any public page; they are probably on the login-only portal
(app.innovationcarnival.io) [I]. Someone registered must read them there and paste the source.

- Official listing (Internshala, NPCI x Citi): registration 10 to 30 Sep 2026; solutions
  "should align with the broad pillars of innovation, scalability, and real-world impact";
  participants are "expected to ideate, collaborate and build working prototypes". No
  challenge codes, no scoring rubric [P].
  https://internshala.com/competitions/drunix-hackathon-2026-by-npci-x-citi/
- Innovation Carnival "current challenges" page: five tracks (AI & Fraud Detection, Real-Time
  Payments, Financial Inclusion, Cross-Border Remittances, Open Finance APIs). No codes
  or criteria [P]. https://innovationcarnival.io/current-challenges/
- Project Axis README (another team): "organised by the India Blockchain Forum"; challenge
  code CHL-7007 (Cross-Border Remittances). It also cites the hackathon FAQ for a
  demo flow (Problem, User Journey, Solution, Architecture, Drunix Flow, Working Prototype,
  Impact) and for IP staying with participants [S]. https://github.com/ferroflux/project-axis
- Still unknown: our challenge code and track, the judging rubric, and what the prototype
  must show.
- 20 Oct 2026: timeline and deadline removed from this item at the lead's request.

### U-02, U-03, U-04, U-05, U-07, U-11 (p3's network sessions, recorded by p1, 20 Oct 2026)

Source for every item: `docs/logs/p3.md`, sessions 2026-10-18 20:44, 22:42 and 22:46 (command
output quoted there). Drunix commit 8090e0c, built from source; images `npcioss/drunix-*` 1.0.0.

- **U-05 CLOSED.** `bash network/up.sh` (`./network.sh up createChannel -c receiptbook -s yugabyte`)
  exited 0: "Channel 'receiptbook' created", joined by all four peers, anchor peers set for
  Org1MSP and Org2MSP.
- **U-11 CLOSED.** p3's MacBook (macOS, arm64, Docker 29.8.0) is the host machine, with
  Homebrew bash 5.3, Drunix binaries built with `make`, and the amd64-only Drunix images run
  under emulation. Setup steps: `network/README.md`. Other members develop against fakes.
- **U-02 CLOSED.** Both peer types serve the Fabric Gateway API. Drunix's own
  `application-gateway-typescript` sample (`@hyperledger/fabric-gateway` 1.13.0, the same version
  as `gateway/`) ran submit, evaluate, async submit with commit status, and an expected error,
  all OK, against lp1.org1 `localhost:7051`, cp.org1 `localhost:7061` and lp1.org2
  `localhost:9051` on `receiptbook`. Chaincode always ran on the lite peers. The gateway's
  default is the lite peer per org; the committing peer is a tested fallback [I: choice, not a
  measured difference]. A chaincode error arrives in `details[]` as
  `"chaincode response 500, <message>"`, which matches D-21 (CCR-p3-4a).
- **U-03 CLOSED.** `./network.sh deployCC -c receiptbook -ccn basic -ccl typescript -ccep
  "AND('Org1MSP.peer','Org2MSP.peer')"` committed with "Approvals: [Org1MSP: true, Org2MSP:
  true]"; network.sh passes `-ccep` on as `--signature-policy`. TypeScript needs ISS-p3-8:
  the peer's node runtime image `npcioss/fabric-nodeenv:2.5` does not exist on Docker Hub, so
  the deploying machine runs `docker tag hyperledger/fabric-nodeenv:2.5
  npcioss/fabric-nodeenv:2.5` first. That this image is a correct substitute is [I].
- **U-04 SETTLED BY DECISION (D-23), not answered.** `-s` only decides whether YugabyteDB starts;
  the compose files hard-code `sqldb` (YugabyteDB) and KeyDB for every peer. Another state DB
  would mean editing NPCI's compose files. Not tried.
- **U-07 still OPEN.** Evidence so far: Drunix's TypeScript sample chaincode builds and runs on
  Drunix peers with the ISS-p3-8 workaround. Our own stub has not been deployed. p2 closes it
  with P2-G1-T2 (REQ-p3-2 passes to p2 under D-22).
