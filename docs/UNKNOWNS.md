# UNKNOWNS.md (owner: p1; each item has an owner who closes it with evidence)

Rule: nobody codes as if an unknown were known. Close an item by writing the evidence
(command + output, or source link + quote) and the date, then mark it CLOSED.

| ID | Unknown | Why it matters | Owner | Close by | How to close | Status |
|---|---|---|---|---|---|---|
| U-01 | Our challenge code, judging criteria, prototype requirement, official FAQ | Whether "admit a database baseline" is acceptable; what the prototype must show | p1 | G1 | ask the organisers (India Blockchain Forum, per Project Axis's README); get the FAQ | OPEN: challenge code, organiser and themes confirmed from the portal (22 Oct); judging criteria, prototype requirement and FAQ still open |
| U-02 | Which Drunix peer serves the Fabric Gateway API (lite or committing), and does `@hyperledger/fabric-gateway` 1.13 work with it | The whole gateway design (D-04) | p3 | G1 | connect from the gateway to each peer; log the result | CLOSED 18 Oct 2026 (p3; evidence below) |
| U-03 | Does Drunix `network.sh deployCC` accept `-ccep` (endorsement policy) and `-ccl typescript` | E3 and deployment | p3 | G1 | read `network.sh` / run it; log | CLOSED 18 Oct 2026 (p3; TypeScript needs the ISS-p3-8 workaround; evidence below) |
| U-04 | Can the state DB be something other than YugabyteDB (issue #8: non-atomic SQL + Redis writes) | Reliability of commits | p3 | G1 | try the `-s` options; log | SETTLED BY DECISION 18 Oct 2026 (D-23: keep YugabyteDB); other state DBs untested |
| U-05 | Does a custom channel name (`receiptbook`) work, or only `mychannel` | Scripts and config | p3 | G1 | `network/up.sh`; log | CLOSED 18 Oct 2026 (p3; evidence below) |
| U-06 | Can a third org be added to the test network (Fabric's `addOrg3` equivalent) | N2, N3 | p3 | after G3 | inspect the test-network folder | OPEN |
| U-07 | Does TypeScript chaincode build and run on Drunix in practice (only Go samples were seen in the repo) | D-02 | p2 + p3 | G1 | deploy the stub chaincode; log | CLOSED 20 Oct 2026 (p2; evidence below) |
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

### U-01 (p1, 20 Oct 2026, web research): still OPEN

Public web search and fetch only; no login. None of the four items (challenge code, judging
criteria, prototype requirement, official FAQ for this hackathon) is confirmed by an official
organiser or NPCI page. All four remain open.

- Organiser site (Innovation Carnival) lists "Drunix Hackathon 2026" as its current challenge:
  "launched by NPCI", "taken forward in collaboration with Citi". Five tracks only; no
  challenge codes, no criteria, no dates. Register link goes to the login-only portal
  https://app.innovationcarnival.io/login. https://innovationcarnival.io/current-challenges/
- Same site, homepage FAQ: generic to the platform, not this hackathon. On juries: "review
  assigned submissions, score solutions, provide expert feedback". No rubric, no prototype or
  IP rule. https://innovationcarnival.io/
- "Supported By" on that homepage shows logos only; one has alt text "IBF-Logo 3". That IBF
  is the India Blockchain Forum named in Project Axis's README is [I]; no public page found
  that links an India Blockchain Forum to this hackathon [U].
- NPCI: no Drunix hackathon page found on npci.org.in. NPCI's X post announcing the hackathon
  (https://x.com/NPCI_NPCI/status/2098992005544296488) could not be fetched (HTTP 402) [U].
- Global Fintech Fest hackathon page lists PSB, SBI, SEBI and NABARD hackathons, not Drunix.
  https://www.globalfintechfest.com/gff-hackathons
- Internshala listing (not organiser-run) re-checked: shows status "Closed", format "Online";
  same pillars quote as 18 Oct; no codes, rubric, prototype rule, FAQ or IP terms [P].
  https://internshala.com/competitions/drunix-hackathon-2026-by-npci-x-citi/
- Other teams' repos: nexus-pvp calls itself a "Production-Grade Prototype" submission; no
  challenge code or rules [S]. https://github.com/Froglodyte/nexus-pvp. Project Axis's
  CHL-7007 and FAQ citations (18 Oct entry) remain the only source for codes and FAQ, and
  are not official [S].
- Remaining: challenge code (and track) for our challenge [U]; judging criteria beyond the
  "innovation, scalability, real-world impact" pillars [U]; what the prototype must show [U];
  the official FAQ text [U]. All four are probably on app.innovationcarnival.io behind login
  [I]; a registered team member must copy them from there.

### U-01 (p1, 22 Oct 2026, organiser portal): partly answered, still OPEN

Source: our challenge page on the organiser's login-only portal (app.innovationcarnival.io),
read by the lead and pasted into the session on 22 Oct 2026. The exact page URL was not recorded
[U]. This is the first official source for U-01 [P].

- **Challenge code: CHL-7007**, "Drunix Hackathon in collaboration with Citi", category
  Blockchain. The code is for the whole hackathon, not one track. This confirms Project Axis's
  CHL-7007 (18 Oct entry); its "Cross-Border Remittances" label was that team's track, not part
  of the code.
- **Organisation: India Blockchain Forum.** This confirms the 20 Oct [I] that the "IBF" logo on
  innovationcarnival.io is the India Blockchain Forum.
- **Active stage: Idea / Deck Submission.** Dates left out on purpose (timeline is not tracked
  in U-01, 20 Oct entry).
- **Problem statements / themes (five):** Real-Time Payments; Real Asset Tokenization;
  Cross-Border Remittances; Financial Inclusion; Innovative Fintech Ideas ("New financial
  technology concepts that improve customer and business outcomes"). This replaces the
  public site's list, which had "AI & Fraud Detection" and "Open Finance APIs" instead of Real
  Asset Tokenization and Innovative Fintech Ideas.
- **Our track: Innovative Fintech Ideas** (lead's choice, D-29).
- **Format:** the whole hackathon is online (registration, ideation, mentoring, development,
  submissions, evaluation). The Grand Finale is hybrid: the top 10 finalist teams give a final
  pitch, live demos and jury evaluation, in person or virtually. The page promises access to
  NPCI APIs and infrastructure and to Citi mentors.
- **Still open:** judging criteria / rubric (the page names none) [U]; what the prototype must
  show (only "live demos" at the finale) [U]; the official FAQ [U]. Next: check the portal's
  other tabs (rules, FAQ, evaluation) and the deck-submission form.

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
- **U-07 CLOSED.** (p2, 20 Oct 2026; source `docs/logs/p2.md`, session 2026-10-20 15:55,
  P2-G1-T2, REQ-p2-1). p2 deployed our stub chaincode (branch `p2/g1-rules`, `receiptBook.ts`
  still throws NotImplemented) on a Drunix test network on p2's own Mac (macOS arm64, MacBook
  Air, Docker Desktop 29.9.1), Drunix 8090e0c built from source, amd64 images
  `npcioss/drunix-peer|orderer|vscc:1.0.0` under emulation, with the ISS-p3-8 workaround
  (`docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5`). Commands:
  `bash network/up.sh` then `bash network/deploy.sh`.
  - `peer lifecycle chaincode commit ... --name receiptbook --version 1.0 --sequence 1
    --signature-policy 'AND('Org1MSP.peer','Org2MSP.peer')'` gave "committed with status
    (VALID)" at localhost:7061 and :9061; querycommitted: "Approvals: [Org1MSP: true, Org2MSP:
    true]".
  - `peer chaincode query -C receiptbook -n receiptbook` with
    `org.hyperledger.fabric:GetMetadata` (Org1 lite peer) returned contract `ReceiptBook` with
    CreateRecord and RecordMilestone tagged SUBMIT, GetRecord and ListRecords tagged EVALUATE.
  - `GetRecord` returned `status:500 message:"NotImplemented: P2 G2"`: our own TypeScript code
    ran on a Drunix peer.
  - `docker ps`: `dev-peer0.org1.example.com-receiptbook_1.0-…` and `dev-peer0.org2…` Up.
  - This ran with the ISS-p3-8 node-runtime workaround; without it is untested, and that the
    substitute image is correct remains [I]. p2 answered REQ-p3-2: keep the workaround for now.
