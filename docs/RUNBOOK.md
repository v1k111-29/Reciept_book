# Operations runbook

How to bring up Receipt Book on a Drunix test network, check that it is healthy, run the live
checks and the demo, and fix the problems seen so far. Network details and platform notes are in
[`network/README.md`](../network/README.md); the design is in [ARCHITECTURE.md](ARCHITECTURE.md).

Everything here needs a Linux machine with Docker (macOS on Apple Silicon also works; see
`network/README.md`). If you have no such machine, use the hosted live workflow
(section 6).

## 1. One-time setup

```bash
git clone https://github.com/npci/drunix ../drunix          # next to this repository
(cd ../drunix && make peer orderer configtxgen configtxlator osnadmin cryptogen discover ledgerutil)
cp network/env.example.sh network/env.sh                     # set DRUNIX_DIR to the absolute path of ../drunix
docker pull hyperledger/fabric-nodeenv:2.5 && docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5
command -v docker-compose                                    # must print a path (see below)
uv sync
(cd gateway && npm ci) && (cd frontend && npm ci)
```

- The Drunix host binaries are built from source; `./network.sh prereq` downloads upstream
  Fabric's binaries, not Drunix's.
- The `fabric-nodeenv` tag is needed because Drunix's own node runtime image for TypeScript
  chaincode is not published (U-03). That the upstream image is a correct substitute is [I].
- The standalone `docker-compose` command is required: `network.sh` starts YugabyteDB and KeyDB
  with a hard-coded `docker-compose`. The `docker compose` plugin alone is not enough.
- `live.yml` pins Drunix to commit `8090e0ce58802c8a0f13d23a6abe5a2d35456cc5`; check out the same
  commit for comparable results.

`network/env.sh` is gitignored. It sets `DRUNIX_DIR`, `S14_CHANNEL`, `S14_CHAINCODE`,
`S14_ENDORSEMENT_POLICY` and `S14_STATE_DB`.

## 2. Network

```bash
bash network/up.sh        # network up + channel receiptbook (YugabyteDB state DB)
bash network/deploy.sh    # package and deploy chaincode/ with -ccl typescript and the AND policy
bash network/down.sh      # stop; removes containers, volumes and all crypto material
```

A fresh network takes the chaincode at sequence 1. Redeploying onto a network that already has
`receiptbook` needs a new version and sequence; `down.sh` then `up.sh` avoids that.

## 3. Services

```bash
# gateway on :8800 (reads the S14_* identity variables from network/gateway-env.sh)
source network/gateway-env.sh && (cd gateway && npm run dev)

# backend on :8000 (in another shell)
export S14_HASH_SALT=<your own value>          # never commit it
export S14_GATEWAY_URL=http://localhost:8800
uv run uvicorn s14.api:app --app-dir backend --port 8000

# UI on :5173 (in another shell); /api is proxied to :8000
(cd frontend && npm run dev)
```

Seed synthetic records through the running backend:

```bash
PYTHONPATH=backend uv run python -m s14.seed --count 30 --backend http://localhost:8000
```

It prints `loaded N/30` and the count per cause bucket read back from `GET /records`. On a fresh
network, 30 records give 6 in each of the five buckets.

## 4. Health checks

```bash
curl -s localhost:8800/health        # {"status":"ok","contracts_version":"1.1.0"}
curl -s localhost:8000/health        # same shape
docker ps -a --filter name=cp.org --format '{{.Names}} {{.Status}}'             # both committing peers Up
docker exec yugabyte-org1 grep -c "tserver died" /root/var/logs/yugabyted.log   # 0; repeat for yugabyte-org2
bash network/last-block.sh 1         # newest block on Org1's committing peer, with validation codes
```

## 5. Live checks and the demo

With the network up and the chaincode deployed:

```bash
source network/gateway-env.sh && (cd gateway && npm run dev) &
S14_LIVE=1 uv run pytest tests/integration -v    # live suite against the gateway
bash scripts/e3_endorsement_check.sh             # one-org write invalidated, two-org write committed
```

`test_rejects_other_bank_wrong_bank` is skipped: it needs a second bank organisation (roadmap).
Nothing else may write to the channel while `e3_endorsement_check.sh` runs.

The full demo, from a clean network:

```bash
bash scripts/demo.sh
```

It takes the network down and up, deploys the chaincode, installs dependencies, starts the
gateway and the backend (with a random demo-only salt unless `S14_HASH_SALT` is set), seeds 30
synthetic records and serves the UI at http://localhost:5173. Ctrl-C stops everything. Logs go to
`.demo-logs/`. It stops if port 8800, 8000 or 5173 is already in use.

Headless (as the live workflow runs it):

```bash
S14_DEMO_HEADLESS=1 S14_DEMO_CHECK='NODE_PATH=<dir>/node_modules node scripts/ui_smoke.mjs' bash scripts/demo.sh
```

`scripts/ui_smoke.mjs` needs Playwright resolvable through `NODE_PATH` (it is not a project
dependency); it creates a record, records PAYMENT_RECEIVED, opens the timeline and the metrics
view, and saves screenshots to `S14_UI_SHOTS` (default `.demo-logs/ui`).

## 6. Hosted live verification

`.github/workflows/live.yml` does sections 1 to 5 on a GitHub-hosted Ubuntu runner (D-33). Run
it by hand:

```bash
gh workflow run live.yml --ref <branch>
```

It also runs on pushes to branches matching `p1/g2-live-*`. It passes only if the live suite,
the endorsement check and the headless demo (`loaded 30/30`, six records in each bucket, UI
smoke test) all pass. Logs, container logs and screenshots are in the run's `live-evidence`
artifact.

## 7. Troubleshooting

**YugabyteDB died after the host slept (D-27).** The tserver can die and restart inside its
container while the container stays "Up". Afterwards that DB may reject every write
("Attempted to commit expired transaction"), and the committing peer panics on the next block
and exits. If the health check in section 4 shows a death or an exited `cp.org*` peer, rebuild:
`bash network/down.sh && bash network/up.sh && bash network/deploy.sh`. Restarting the peer alone
did not help. Rebuild before any live run or demo, and do not let the host sleep during them.

**"ProposalResponsePayloads do not match" or an unexpected NOT_FOUND right after a write.** The
two orgs' peers briefly disagree when one has committed the previous write and the other has
not. The gateway retries the endorsement up to 3 times and waits for the other org's peer to
commit each write before returning (see ARCHITECTURE.md, "Errors and retries"). If it still
happens, the gateway log shows a warning for the second-org wait; retry the request, and check
that both committing peers are Up.

**`docker-compose: command not found` during `up.sh`.** No database containers start and every
peer exits ("lookup hlf_keydb_org1msp ... no such host"). Install the standalone
`docker-compose`.

**`pull access denied for npcioss/fabric-nodeenv`** during deploy: run the `docker tag` line from
section 1.

**`peer chaincode invoke --waitForEvent` times out** against the lite peers (:7051, :9051): lite
peers keep no blocks and send no commit events. Leave out `--waitForEvent` and read the result
with `bash network/last-block.sh <1|2>`.

**`OUTCOME_UNKNOWN` (504) from the backend.** The write may still have committed. Open the
record's timeline before trying again.

**Gateway exits at start with a config error.** It names every missing `S14_*` variable; source
`network/gateway-env.sh` in the same shell first.

**Backend write routes return INTERNAL "S14_HASH_SALT is not configured".** Export
`S14_HASH_SALT` before starting the backend.
