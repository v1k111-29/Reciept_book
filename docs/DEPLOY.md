# Deploying on one Linux VM

`deploy/` and `scripts/deploy.sh` run the whole stack on one Ubuntu VM with Docker: the Drunix
test network (started by `network/up.sh` and `network/deploy.sh`, as everywhere else), plus the
gateway, the backend and the UI as Docker Compose services behind a Caddy reverse proxy with
basic auth (D-35). Every part is open source; see [Licences](#licences).

```
 Internet ──80/443──► Caddy (web)  basic auth on everything; static UI; /api/* → 127.0.0.1:8000
                        │
                        ▼
                      backend  127.0.0.1:8000   (S14_HASH_SALT from deploy/.env)
                        │
                        ▼
                      gateway  127.0.0.1:8800   (S14_* from deploy/gateway.env)
                        │  gRPC localhost:7051 / 9051
                        ▼
                      Drunix test network (network/up.sh), ledger in Docker volumes
```

All three services use `network_mode: host` (Linux only), so the gateway reaches the peers
exactly as `network/gateway-env.sh` configures them. The gateway and the backend listen on
127.0.0.1 only (`S14_GATEWAY_HOST=127.0.0.1` and uvicorn `--host 127.0.0.1`).

| File | Role |
|---|---|
| `deploy/docker-compose.yml` | Services `gateway`, `backend`, `web`; health checks; Caddy data volume |
| `deploy/Dockerfile.gateway` | Node 22 slim; `npm ci`, `npm run build`, dev dependencies pruned; `node dist/main.js` |
| `deploy/Dockerfile.backend` | Python 3.11 slim; `uv sync --frozen --no-dev`; uvicorn on 127.0.0.1:8000 |
| `deploy/Dockerfile.web` | Builds the UI (`npm run build`), serves it with `caddy:2.10` |
| `deploy/Caddyfile` | Site address, basic auth, `/api` proxy with streaming, SPA fallback |
| `deploy/env.example` | Documents `deploy/.env` (written by `deploy.sh`, gitignored, mode 600) |
| `scripts/deploy.sh` | `up [--fresh-network]`, `down`, `status`, `logs` |

## Prerequisites

- An Ubuntu VM on x86-64: Drunix's images are published for linux/amd64 only
  ([network/README.md](../network/README.md)).
- Size: the hosted runner that passes the live workflow has 2 CPUs and 7.8 GiB RAM (D-33). Use at
  least that. More (for example 4 CPUs and 16 GiB, and 40 GB of disk for images and the ledger)
  is a suggestion [I], not measured.
- Docker Engine (`network.sh` says Docker <= 28) with the Compose v2 plugin, plus the standalone
  `docker-compose` command that Drunix's `network.sh` needs; git, Go, jq, curl and openssl.
- The user running `deploy.sh` may use Docker (member of the `docker` group).

## One-time setup

As in [network/README.md](../network/README.md) and [RUNBOOK.md](RUNBOOK.md) section 1:

```bash
git clone <this repository> receipt-book && cd receipt-book
git clone https://github.com/npci/drunix ../drunix
git -C ../drunix checkout 8090e0ce58802c8a0f13d23a6abe5a2d35456cc5    # the commit live.yml pins
(cd ../drunix && make peer orderer configtxgen configtxlator osnadmin cryptogen discover ledgerutil)
cp network/env.example.sh network/env.sh       # DRUNIX_DIR must be an ABSOLUTE path to ../drunix
docker pull hyperledger/fabric-nodeenv:2.5 && docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5
command -v docker-compose                       # must print a path
```

## First deploy

```bash
bash scripts/deploy.sh up
```

It:

1. Checks Docker, Compose v2 and `network/env.sh`.
2. Starts the Drunix network and deploys the chaincode **only if the network is not already
   running** (it looks for the `lp1.org1/2`, `cp.org1/2` and `orderer` containers, and asks the
   peer whether `receiptbook` is committed). If only part of the network is running it stops and
   asks you to look ([RUNBOOK.md](RUNBOOK.md) section 7) or to use `--fresh-network`.
3. On the first run, writes `deploy/.env` (mode 600) with a random `S14_HASH_SALT`
   (`openssl rand -hex 32`), `SITE_ADDRESS=':80'`, `BASIC_AUTH_USER='receiptbook'` and the bcrypt
   hash of a generated password (`caddy hash-password` in the pinned Caddy image). **The password
   is printed once, at the end; only its hash is stored.**
4. Writes `deploy/gateway.env` from `network/gateway-env.sh` (paths only; mode 600) and checks
   that every certificate and key path in it is readable. The Drunix `organizations` directory is
   mounted read-only into the gateway at the same absolute path, and the gateway runs as your
   uid:gid, because the private keys may be readable by their owner only.
5. `docker compose -f deploy/docker-compose.yml up -d --build --force-recreate`, then waits for the
   gateway and backend health checks and for the site to answer 401 without credentials (and
   `/api/health` with them, when the password is known in this run). It prints the URL.

Open `http://<vm-address>/` and sign in as `receiptbook` with the printed password.

**The salt.** Never change or lose `S14_HASH_SALT` once records exist: every shipping-bill and
reference hash on the ledger was made with it, and a different salt makes all of them
unfindable. `deploy.sh` never overwrites it. Back up `deploy/.env` somewhere safe.

`--fresh-network` takes the network down and up again and redeploys the chaincode. **It erases
the ledger** (every record) and all crypto material; on a terminal it asks you to type `erase`.

Automation: `DEPLOY_BASIC_AUTH_PASSWORD=<password> bash scripts/deploy.sh up` uses that password
instead of generating one (the live workflow does this).

## A domain and HTTPS

Point a DNS name at the VM, then set it in `deploy/.env` and redeploy:

```bash
sed -i "s/^SITE_ADDRESS=.*/SITE_ADDRESS='receipts.example.org'/" deploy/.env
bash scripts/deploy.sh up
```

Caddy then gets a certificate automatically and redirects HTTP to HTTPS; ports 80 and 443 must be
reachable from the internet for that. Certificates live in the `caddy_data` volume, which
`deploy.sh down` keeps. `SITE_ADDRESS=':80'` (the default) serves plain HTTP: then the password
crosses the network in clear text, so use it only on a trusted network.

## Firewall

Open only 80 and 443 (and SSH for yourself):

```bash
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable
```

The gateway (8800), the backend (8000) and Caddy's admin API (2019) listen on 127.0.0.1 only.
The Drunix test network's containers publish their own ports (7050, 7051, 9051, ...) on all
interfaces through Docker; Docker's port publishing is known to bypass ufw rules [I], so also
block those at your cloud provider's firewall or security group.

## Day to day

```bash
bash scripts/deploy.sh status     # docker compose ps
bash scripts/deploy.sh logs       # docker compose logs -f
bash scripts/deploy.sh down       # stop gateway, backend, web; the network and ledger keep running
bash network/down.sh              # stop the network: ERASES the ledger and all crypto material
```

The services restart automatically (`restart: unless-stopped`). The Drunix containers are
managed by Drunix's `network.sh`, not by this kit; check them after a reboot with
[RUNBOOK.md](RUNBOOK.md) section 4 (D-27).

**Rotate the basic-auth password:**

```bash
DEPLOY_BASIC_AUTH_PASSWORD='<new password>' bash scripts/deploy.sh up
# or: delete the BASIC_AUTH_HASH line from deploy/.env and run `bash scripts/deploy.sh up`;
# a new password is generated and printed once.
```

The salt is kept either way.

**Update to a new version:**

```bash
git pull
bash scripts/deploy.sh up          # rebuilds the images; the network and ledger are left alone
```

If the new version changes the chaincode, the running network still has the old one: redeploying
onto an existing network needs a new chaincode version and sequence, which `network/deploy.sh`
does not do ([RUNBOOK.md](RUNBOOK.md) section 2). The only supported path today is
`--fresh-network`, which erases the ledger.

## Backups and data loss

- The ledger lives in the Drunix test network's Docker containers and volumes.
  `network/down.sh` (and `--fresh-network`) erases it, and so does anything that removes those
  volumes (`docker system prune --volumes`). The kit has no ledger backup.
- `deploy/.env` holds the salt and the password hash: back it up. Without the salt the ledger's
  records cannot be looked up again.
- The `caddy_data` volume holds certificates and can be recreated.
- After the host sleeps or is suspended, YugabyteDB can break the network (D-27); keep the VM
  running and check it as in RUNBOOK.md section 4.

## Limitations

- **Test network, not production.** It is Drunix's test network with cryptogen's sample
  crypto material, one orderer and both organisations on one machine. It is a pilot, not a
  production blockchain deployment.
- **One shared login.** Basic auth is one credential for everyone and does not distinguish
  organisations; anyone with it can act as either organisation, as without the proxy
  ([README.md](../README.md) Known limitations).
- **Joining a real Drunix network** (other organisations' peers, a real CA, real identities) is
  unknown [U]; the kit only knows the test network.
- The salt is visible to anyone who can run `docker inspect` on the VM.
- Linux only (`network_mode: host`).

## Licences

Receipt Book: Apache-2.0. Drunix: Apache-2.0, per its repository. Docker Engine and Docker
Compose: Apache-2.0. Caddy: Apache-2.0.
