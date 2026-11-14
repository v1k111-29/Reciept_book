# Open technical questions

Rule: do not code as if an unknown were known. Close an item by recording the evidence (command
and output, or source link and quote) and the date, then mark it CLOSED. Item numbers are
stable because code and docs cite them (for example `U-12` in `backend/s14/contracts.py`).
Numbers missing from the sequence were project-process questions and remain in git history.

All Drunix findings below are against npci/drunix commit 8090e0c, built from source, with the
images `npcioss/drunix-peer|orderer|vscc:1.0.0`.

| ID | Question | Status |
|---|---|---|
| U-02 | Which Drunix peer serves the Fabric Gateway API, and does `@hyperledger/fabric-gateway` 1.13 work with it? | CLOSED: both peer types |
| U-03 | Does `network.sh deployCC` accept `-ccep` (endorsement policy) and `-ccl typescript`? | CLOSED: yes, with a node-runtime image workaround |
| U-04 | Can the state DB be something other than YugabyteDB? | SETTLED BY DECISION (D-23): keep YugabyteDB; others untested |
| U-05 | Does a custom channel name (`receiptbook`) work? | CLOSED: yes |
| U-06 | Can a third organisation be added to the test network? | OPEN: source read, no live test |
| U-07 | Does TypeScript chaincode build and run on Drunix? | CLOSED: yes, with the U-03 workaround |
| U-08 | Do private data collections work on Drunix? | OPEN: source read, no live test |
| U-09 | Do the GitHub Actions versions in CI work? | CLOSED: yes |
| U-11 | What machine can host the Drunix test network? | CLOSED: Linux (GitHub-hosted runner, D-33); macOS on Apple Silicon also worked |
| U-12 | What does the ledger timestamp prove? | CLOSED: submission time, not the real-world step; one residual [I] |

## Answers and evidence

### U-02: CLOSED (18 Oct 2026)

Both peer types serve the Fabric Gateway API. Drunix's own `application-gateway-typescript`
sample (`@hyperledger/fabric-gateway` 1.13.0, the version `gateway/` uses) ran submit, evaluate,
async submit with commit status, and an expected error against the Org1 lite peer
`localhost:7051`, the Org1 committing peer `localhost:7061` and the Org2 lite peer
`localhost:9051` on channel `receiptbook`. Chaincode always ran on the lite peers. The gateway
defaults to each org's lite peer; the committing peer is a tested fallback [I: a choice, not a
measured difference]. A chaincode error arrives in `details[]` as
`"chaincode response 500, <message>"`, which matches D-21.

### U-03: CLOSED (18 Oct 2026)

`./network.sh deployCC -c receiptbook -ccn basic -ccl typescript -ccep
"AND('Org1MSP.peer','Org2MSP.peer')"` committed with "Approvals: [Org1MSP: true, Org2MSP:
true]"; `network.sh` passes `-ccep` on as `--signature-policy`. TypeScript chaincode needs a
workaround: the peer's node runtime image `npcioss/fabric-nodeenv:2.5` is not published, so the
deploying machine runs `docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5`
first. That this image is a correct substitute is [I].

### U-04: SETTLED BY DECISION (D-23), not answered

`-s` only decides whether YugabyteDB starts; the compose files hard-code `sqldb` (YugabyteDB)
and KeyDB for every peer. Another state DB would mean editing NPCI's compose files. Not tried.

### U-05: CLOSED (18 Oct 2026)

`bash network/up.sh` (`./network.sh up createChannel -c receiptbook -s yugabyte`) exited 0:
"Channel 'receiptbook' created", joined by all four peers, anchor peers set for Org1MSP and
Org2MSP.

### U-06: OPEN (source read 25 Oct 2026; nothing run)

Needed for a third organisation (a second bank) and for Customs as a read-only organisation
(both on the roadmap).

- **No add-org script.** No path under `drunix-network/` contains `addOrg` or `org3`. It holds
  only `asset-transfer-basic`, `asset-transfer-private-data`, `config` and `test-network`
  (https://github.com/npci/drunix/tree/8090e0ce58802c8a0f13d23a6abe5a2d35456cc5/drunix-network).
- **Only leftovers of Fabric's addOrg3 remain**, as comments or dead code in
  `test-network/scripts/envVar.sh`, `scripts/setAnchorPeer.sh` and `scripts/configUpdate.sh`.
- **Org1 and Org2 are hard-coded** in `configtx/configtx.yaml`, `createChannel.sh`,
  `deployCC.sh`, `envVar.sh` and `network.sh`.
- **One Drunix org needs five containers:** a lite peer, a committing peer, a validation server
  (`npcioss/drunix-vscc`), a YugabyteDB container and a KeyDB container.
- **What a third org would take [I]:** bring the network up with three orgs from the start (an
  org3 crypto-config, an `Org3` block in configtx.yaml, five more compose services with new
  ports, and org-3 cases in the scripts above). These are NPCI's files, so this repository would
  carry a patch or overlay. Adding Org3 to a running channel instead needs Fabric 2.5's
  config-update flow; that it works unchanged on Drunix is [I].
- **Still [U], needs a live test:** whether a three-org network comes up, whether the Drunix peer
  accepts an MSP added by config update, and whether a host has the resources.

### U-07: CLOSED (20 Oct 2026)

The stub chaincode, then the real one, deployed with `bash network/up.sh` and
`bash network/deploy.sh` (with the U-03 workaround). `peer lifecycle chaincode commit ... --name
receiptbook --signature-policy "AND('Org1MSP.peer','Org2MSP.peer')"` gave "committed with status
(VALID)"; `querycommitted` showed "Approvals: [Org1MSP: true, Org2MSP: true]". `GetMetadata`
returned contract `ReceiptBook` with CreateRecord and RecordMilestone tagged SUBMIT and GetRecord
and ListRecords tagged EVALUATE, and a call ran our TypeScript code on a Drunix peer. Without the
node-runtime workaround is untested.

### U-08: OPEN (source read 25 Oct 2026; nothing run)

Needed for amounts in a private data collection (roadmap).

- **The sample exists:** `drunix-network/asset-transfer-private-data/`, Go chaincode only, with
  `collections_config.json`
  (https://github.com/npci/drunix/tree/8090e0ce58802c8a0f13d23a6abe5a2d35456cc5/drunix-network/asset-transfer-private-data).
- **`-cccg` is supported:** `network.sh` passes it to `deployCC.sh` as `--collections-config`,
  and `ccutils.sh` adds it to approve, commit-readiness check and commit.
- **Design:** Drunix's `docs/drunix-arch.md` ("Private Data Management", "Private Data
  Retrieval") says the lite peer stores private data in the per-org KeyDB transient store and
  disseminates it to eligible peers in other orgs; the committing peer reads the transient store
  first
  (https://github.com/npci/drunix/blob/8090e0ce58802c8a0f13d23a6abe5a2d35456cc5/docs/drunix-arch.md).
- **Still [U], needs a live test:** whether private data works end to end with lite peers that
  run with gossip state off, whether the sample's CouchDB index folder matters on YugabyteDB, how
  Org2 receives Org1's private data, and whether `putPrivateData` from TypeScript chaincode works
  on Drunix.
- **Live test to run:** from `test-network`, `./network.sh deployCC -c receiptbook -ccn private
  -ccp ../asset-transfer-private-data/chaincode-go -ccl go -cccg
  ../asset-transfer-private-data/chaincode-go/collections_config.json -ccep
  "OR('Org1MSP.peer','Org2MSP.peer')"`. Check `querycommitted` shows the collections, then write
  and read from each org.

### U-09: CLOSED (24 Oct 2026)

`actions/checkout@v4`, `actions/setup-node@v4` and `astral-sh/setup-uv@v5` run green in
`.github/workflows/ci.yml`. `live.yml` also uses `actions/setup-go@v5` and
`actions/upload-artifact@v4`.

### U-11: CLOSED

The Drunix test network is documented for Linux with git, Docker (`network.sh` says <= 28), Go,
jq and Bash 4+. Live verification runs on a GitHub-hosted Ubuntu runner (D-33). macOS on Apple
Silicon also ran it, with the amd64 images under emulation and Docker 29.8.0; see
[`network/README.md`](../network/README.md).

### U-12: CLOSED (23 Oct 2026), one residual [I]

- **Source reading.** fabric-shim 2.5.8 `lib/stub.js`, `getDateTimestamp()`: "This is taken
  from the transaction ChannelHeader, therefore it will indicate the client's date, and will have
  the same value across all endorsers." The chaincode stores `ctx.stub.getTxTimestamp()` as
  `ledger_time` (UTC ISO 8601 with `Z`).
- **Live comparison.** The block header `channel_header.timestamp` matched the stored
  `ledger_time` to the millisecond for three transactions, and was set when the client built the
  proposal (about 50 ms after the client clock read), not at commit.
- **Answer.** `ledger_time` is the submitting client's clock when it built the signed proposal,
  unchanged by the Drunix peers and truncated to milliseconds. It shows when a signed record was
  submitted, not when the real-world step happened; that is `occurred_on`, attested by the
  submitter. A client with a wrong clock puts a wrong time on the ledger. Wording in the UI and
  docs should say "recorded" or "submitted", never "happened".
- **Residual [I]:** whether Drunix rejects a proposal whose client clock is far off (a clock-skew
  check) was not tested.
