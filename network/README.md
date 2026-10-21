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
- **The standalone `docker-compose` command is required** on every OS. `network.sh up` and `down`
  start and stop YugabyteDB and KeyDB with a hard-coded `docker-compose -f scripts/yugabyte/compose.yaml`
  (hyphenated). The `docker compose` plugin alone is not enough. Without it, up.sh prints
  "docker-compose: command not found", no DB containers start, and every peer exits ("lookup
  hlf_keydb_org1msp ... no such host"). Check with `command -v docker-compose` (found by p2,
  ISS-p2-8).
- **JavaScript/TypeScript chaincode:** the peer runs it in `npcioss/fabric-nodeenv:2.5`, which is not
  published. Install fails with "pull access denied for npcioss/fabric-nodeenv". Before the first
  deploy on any machine, run:
  `docker pull hyperledger/fabric-nodeenv:2.5 && docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5`
  (log ISS-p3-8). That upstream Fabric's image is a correct substitute is [I]; Drunix's TypeScript
  sample ran fine with it.
- `deployCC` installs chaincode on the lite peers only. They execute it, and the committing peers
  hold the blocks.
- Fabric Gateway API (`@hyperledger/fabric-gateway` 1.13.0, tested 18 Oct 2026): served by both the
  lite peers and the committing peers. Gateway default [I]: Org1 → `localhost:7051` (TLS host name
  `peer0.org1.example.com`), Org2 → `localhost:9051` (`peer0.org2.example.com`). Client certificates are
  in `test-network/organizations/peerOrganizations/orgN.example.com/users/User1@orgN.example.com/msp/`,
  and the peer TLS CA is in `.../peers/peer0.orgN.example.com/tls/ca.crt`.

```bash
git clone https://github.com/npci/drunix ../drunix          # next to this repo
(cd ../drunix && make peer orderer configtxgen configtxlator osnadmin cryptogen discover ledgerutil)
cp network/env.example.sh network/env.sh                     # set DRUNIX_DIR (absolute path)
bash network/up.sh        # network up + channel receiptbook
bash network/deploy.sh    # our chaincode
bash network/down.sh      # stop; deletes containers, volumes and all crypto material
```

Start the gateway against the network (it reads S14_* from `network/gateway-env.sh`):
```bash
source network/gateway-env.sh && (cd gateway && npm run dev)   # gateway on :8800
curl -s localhost:8800/health
```

**After the host sleeps, check the state DBs before trusting the network** (ISS-p3-9, 21 Oct 2026).
YugabyteDB's tserver can die and restart inside its container while the container stays "Up".
Afterwards that DB may reject every write ("Attempted to commit expired transaction"), and the
committing peer **panics** on the next block and exits. Check:
```bash
docker exec yugabyte-org1 grep -c "tserver died" /root/var/logs/yugabyted.log   # also yugabyte-org2
docker ps -a --filter name=cp.org --format '{{.Names}} {{.Status}}'             # both must be Up
```
If either shows a death, or a `cp.org*` peer has exited: `bash network/down.sh && bash network/up.sh`,
then redeploy. Restarting the peer alone did not help on 21 Oct.

macOS on Apple Silicon also works for the test network (verified 18 Oct 2026; not a supported
Drunix platform):
- Install Bash 5 with `brew install bash`. Our scripts and `network.sh` use `#!/usr/bin/env bash`,
  so Bash 5 must come before `/bin/bash` on PATH.
- If `command -v docker-compose` finds nothing, run `brew install docker-compose` (REQ-p2-2). Some
  Docker Desktop installs already link it into `/usr/local/bin/docker-compose` (p3's Mac); others
  don't (p2's Mac).
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

G1 questions (docs/UNKNOWNS.md), status 18 Oct 2026 (evidence in docs/logs/p3.md):
- U-02 (which peer serves the Fabric Gateway API): answered. Both peer types do.
- U-03 (`-ccep` and `-ccl typescript`): answered. Both work, with the node runtime workaround above.
- U-04 (another state DB): decided, **keep YugabyteDB** (Drunix's default; the compose files hard-code
  sqldb/YugabyteDB for every peer). Whether another DB works is untested; revisit only if Drunix
  issue #8 shows up as flaky commits.
- U-05 (`-c receiptbook`): answered. It works.
