# network/ (owner: P3)

Wraps NPCI's Drunix test network. There is no separate samples repo: `drunix-network/` inside
`github.com/npci/drunix` plays the role of fabric-samples (`test-network`,
`asset-transfer-basic`, `asset-transfer-private-data`).

Checked against the cloned repo (npci/drunix 8090e0c) on 18 Oct 2026, docs/logs/p3.md:
- The README says Linux only, with git, Docker, Go, jq and Bash 4+. `network.sh` also says
  Docker <= 28.
- 2 peer orgs. Each has a lite peer `lp1` (Org1 :7051, Org2 :9051), a committing peer `cp`
  (:7061, :9061) and a validation server `vs1` (:7071, :9071). There is one Raft orderer (:7050).
  Each org also gets a YugabyteDB and a KeyDB container.
- The host CLI binaries (`peer`, `cryptogen`, `configtxgen`, `osnadmin`, ...) are **built from
  source** into `drunix/build/bin`. `./network.sh prereq` does NOT do this: it downloads upstream
  Hyperledger Fabric's `install-fabric.sh`, which gives Fabric binaries and images, not Drunix.
- The images `npcioss/drunix-peer|orderer|vscc:1.0.0` are published for linux/amd64 only.

```bash
git clone https://github.com/npci/drunix ../drunix          # next to this repo
(cd ../drunix && make peer orderer configtxgen configtxlator osnadmin cryptogen discover ledgerutil)
cp network/env.example.sh network/env.sh                     # set DRUNIX_DIR (absolute path)
bash network/up.sh        # network up + channel receiptbook
bash network/deploy.sh    # our chaincode
bash network/down.sh      # stop; deletes containers, volumes and all crypto material
```

macOS on Apple Silicon also works for the test network (verified 18 Oct 2026; not a supported
Drunix platform):
- Install Bash 5 with `brew install bash`. Our scripts and `network.sh` use `#!/usr/bin/env bash`,
  so Bash 5 must come before `/bin/bash` on PATH.
- Pull the amd64 images first: `docker pull --platform linux/amd64 npcioss/drunix-peer:1.0.0`
  (and the same for `drunix-orderer` and `drunix-vscc`). Docker Desktop runs them under
  emulation, and compose prints a platform warning for each one.
- It ran on Docker 29.8.0 even though `network.sh` says <= 28.

To use the `peer` CLI by hand, from `../drunix/drunix-network/test-network`:
```bash
export PATH=$PWD/../../build/bin:$PATH FABRIC_CFG_PATH=$(cd ../config && pwd)
source ./scripts/envVar.sh && setGlobals <org 1|2> <peer 0=lite|1=committing>
peer channel getinfo -c receiptbook
```

Open questions P3 must close at G1 (docs/UNKNOWNS.md): U-02 which peer serves the Fabric
Gateway API; U-03 does `deployCC` accept `-ccep` and `-ccl typescript`; U-04 can the state DB
be switched away from YugabyteDB; U-05 does `-c receiptbook` work or must we use `mychannel`
(works, 18 Oct 2026). Record every finding in docs/logs/p3.md.
