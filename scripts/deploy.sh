#!/usr/bin/env bash
# Single-VM deployment: Drunix test network + gateway + backend + UI behind Caddy (docs/DEPLOY.md).
#   bash scripts/deploy.sh up [--fresh-network]   network (only if not running) + build + start + checks
#   bash scripts/deploy.sh down                   stop the three services; network and ledger untouched
#   bash scripts/deploy.sh status | logs          docker compose ps / logs -f
# Needs: Linux, docker with compose v2 (plugin or standalone docker-compose), curl, openssl,
# network/env.sh. Bringing the network up also needs network/README.md's one-time setup.
# Automation: DEPLOY_BASIC_AUTH_PASSWORD=<password> sets the basic-auth password instead of a
# generated one (on an existing deploy/.env it replaces the stored hash; the salt is kept).
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
DEPLOY="$ROOT/deploy"
ENV_FILE="$DEPLOY/.env"
GW_ENV="$DEPLOY/gateway.env"
COMPOSE_FILE="$DEPLOY/docker-compose.yml"
CADDY_IMAGE="caddy:2.10"   # same as deploy/Dockerfile.web
GW_PORT=8800
BACKEND_PORT=8000

die() { echo "deploy: $*" >&2; exit 1; }
say() { echo "deploy: $*"; }

usage() { sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }

CMD="${1:-}"
[ -n "$CMD" ] || usage 1
shift
FRESH=0
for arg in "$@"; do
  case "$arg" in
    --fresh-network) FRESH=1 ;;
    -h|--help) usage 0 ;;
    *) die "unknown option '$arg'" ;;
  esac
done
case "$CMD" in up|down|status|logs) ;; -h|--help) usage 0 ;; *) usage 1 ;; esac

# ---- docker and compose (plugin preferred; a standalone docker-compose must be v2) ----
command -v docker >/dev/null 2>&1 || die "docker not found"
docker info >/dev/null 2>&1 || die "cannot talk to the docker daemon (is it running, and may this user use it?)"
if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1 && docker-compose version 2>/dev/null | grep -qE 'v?2\.'; then
  COMPOSE=(docker-compose)
else
  die "docker compose v2 not found (install the docker compose plugin)"
fi

# Values in deploy/.env are written as KEY='value'.
env_value() { # <key>: value from deploy/.env, quotes removed; empty if absent
  [ -f "$ENV_FILE" ] || return 0
  sed -n "s/^$1='\(.*\)'\$/\1/p; s/^$1=\([^'].*\)\$/\1/p" "$ENV_FILE" | tail -1
}

drunix_orgs_dir() { # needs network/env.sh; prints the organizations dir the gateway mounts
  ( set +u; source "$ROOT/network/env.sh"; echo "$DRUNIX_DIR/drunix-network/test-network/organizations" )
}

compose() {
  export DEPLOY_UID DEPLOY_GID DRUNIX_ORGS_DIR
  DEPLOY_UID="$(id -u)"
  DEPLOY_GID="$(id -g)"
  if [ -z "${DRUNIX_ORGS_DIR:-}" ]; then
    if [ -f "$ROOT/network/env.sh" ]; then DRUNIX_ORGS_DIR="$(drunix_orgs_dir)"; else DRUNIX_ORGS_DIR=/nonexistent; fi
  fi
  "${COMPOSE[@]}" -f "$COMPOSE_FILE" --env-file "$ENV_FILE" "$@"
}

require_deployed() {
  [ -f "$ENV_FILE" ] && [ -f "$GW_ENV" ] || { say "not deployed here (deploy/.env or deploy/gateway.env missing)"; exit 0; }
}

case "$CMD" in
  down)
    require_deployed
    compose down
    say "gateway, backend and web stopped. The Drunix network and its ledger are still running;"
    say "stop it with 'bash network/down.sh' (that ERASES the ledger and all crypto material)."
    exit 0 ;;
  status)
    require_deployed
    compose ps
    exit 0 ;;
  logs)
    require_deployed
    compose logs -f --tail 200
    exit 0 ;;
esac

# ================================ up ================================
[ -f network/env.sh ] || die "network/env.sh missing. cp network/env.example.sh network/env.sh and set DRUNIX_DIR."
for cmd in curl openssl; do
  command -v "$cmd" >/dev/null 2>&1 || die "required command '$cmd' not found"
done
DRUNIX_ORGS_DIR="$(drunix_orgs_dir)"
DRUNIX_DIR="$( set +u; source "$ROOT/network/env.sh"; echo "$DRUNIX_DIR" )"
case "$DRUNIX_DIR" in /*) ;; *) die "DRUNIX_DIR in network/env.sh must be an absolute path (the gateway mounts it at the same path)" ;; esac
[ -d "$DRUNIX_DIR/drunix-network/test-network" ] || die "DRUNIX_DIR ($DRUNIX_DIR) has no drunix-network/test-network"

# ---- Drunix network: start and deploy the chaincode only when needed ----
network_containers() { # running containers of the test network, by name fragment
  docker ps --format '{{.Names}}' | grep -E '(^|[^a-z0-9])(lp1\.org[12]|cp\.org[12]|orderer)' || true
}
network_complete() {
  local names; names="$(network_containers)"
  for frag in lp1.org1 lp1.org2 cp.org1 cp.org2 orderer; do
    grep -qF "$frag" <<<"$names" || return 1
  done
}
chaincode_committed() { # same query as .github/workflows/live.yml
  local out
  out="$(
    set +u; source "$ROOT/network/env.sh"
    cd "$DRUNIX_DIR/drunix-network/test-network"
    export PATH="$PWD/../../build/bin:$PATH" FABRIC_CFG_PATH="$(cd ../config && pwd)"
    set +eo pipefail # Drunix's envVar.sh is not written for strict mode
    source ./scripts/envVar.sh >/dev/null 2>&1; setGlobals 1 1 >/dev/null 2>&1
    peer lifecycle chaincode querycommitted -C "$S14_CHANNEL" -n "$S14_CHAINCODE" 2>&1
  )" || true
  echo "$out" | sed 's/^/deploy:   /'
  grep -q "Version:" <<<"$out"
}
network_prereqs() {
  command -v docker-compose >/dev/null 2>&1 || die "standalone 'docker-compose' not found; Drunix's network.sh needs it (network/README.md)"
  docker image inspect npcioss/fabric-nodeenv:2.5 >/dev/null 2>&1 || die "image npcioss/fabric-nodeenv:2.5 missing: docker pull hyperledger/fabric-nodeenv:2.5 && docker tag hyperledger/fabric-nodeenv:2.5 npcioss/fabric-nodeenv:2.5"
}

NETWORK_STARTED=0
if [ "$FRESH" = 1 ]; then
  echo "deploy: WARNING --fresh-network: network/down.sh ERASES the ledger (every record) and all crypto material." >&2
  if [ -t 0 ]; then
    read -r -p "deploy: type 'erase' to continue: " answer
    [ "$answer" = erase ] || die "aborted"
  fi
  network_prereqs
  bash network/down.sh || true
  bash network/up.sh
  bash network/deploy.sh
  NETWORK_STARTED=1
elif network_complete; then
  say "Drunix network already running; left as it is: $(network_containers | sort | tr '\n' ' ')"
  if chaincode_committed; then
    say "chaincode committed on the channel"
  else
    say "chaincode not committed yet: network/deploy.sh"
    network_prereqs
    bash network/deploy.sh
  fi
elif [ -n "$(network_containers)" ]; then
  docker ps -a --format '{{.Names}} {{.Status}}' | grep -E 'lp1\.org|cp\.org|orderer' >&2 || true
  die "the Drunix network is only partly running. Inspect it (docs/RUNBOOK.md section 7) or rerun with --fresh-network (erases the ledger)."
else
  say "no Drunix network running: network/up.sh + network/deploy.sh"
  network_prereqs
  bash network/up.sh
  bash network/deploy.sh
  NETWORK_STARTED=1
fi

# ---- deploy/.env: salt (never replaced), site address, basic auth ----
hash_password() { # <password> -> bcrypt hash, computed by the pinned Caddy image
  local h
  h="$(docker run --rm "$CADDY_IMAGE" caddy hash-password --plaintext "$1" | tr -d '\r' | tail -1)"
  [[ "$h" =~ ^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$ ]] || die "caddy hash-password gave an unexpected result"
  printf '%s' "$h"
}
PASSWORD=""
NEW_PASSWORD=0
if [ -n "${DEPLOY_BASIC_AUTH_PASSWORD:-}" ]; then
  PASSWORD="$DEPLOY_BASIC_AUTH_PASSWORD"
elif [ ! -f "$ENV_FILE" ] || [ -z "$(env_value BASIC_AUTH_HASH)" ]; then
  PASSWORD="$(openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-24)"
  NEW_PASSWORD=1
fi

umask 077
if [ ! -f "$ENV_FILE" ]; then
  say "creating deploy/.env (new random S14_HASH_SALT)"
  {
    echo "# Written by scripts/deploy.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ). See deploy/env.example."
    echo "# NEVER change S14_HASH_SALT once records exist: it orphans every hash on the ledger."
    echo "S14_HASH_SALT='$(openssl rand -hex 32)'"
    echo "SITE_ADDRESS=':80'"
    echo "BASIC_AUTH_USER='receiptbook'"
  } >"$ENV_FILE"
  echo "deploy: IMPORTANT: back up deploy/.env. Losing or changing S14_HASH_SALT makes every record on the ledger unfindable." >&2
fi
chmod 600 "$ENV_FILE"
[ -n "$(env_value S14_HASH_SALT)" ] || die "deploy/.env has no S14_HASH_SALT. Restore it from your backup; do not invent a new one if the ledger has data."
[ -n "$(env_value BASIC_AUTH_USER)" ] || echo "BASIC_AUTH_USER='receiptbook'" >>"$ENV_FILE"
if [ -n "$PASSWORD" ]; then
  HASH="$(hash_password "$PASSWORD")"
  grep -v '^BASIC_AUTH_HASH=' "$ENV_FILE" >"$ENV_FILE.tmp" || true
  echo "BASIC_AUTH_HASH='$HASH'" >>"$ENV_FILE.tmp"
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
fi
SITE_ADDRESS="$(env_value SITE_ADDRESS)"; SITE_ADDRESS="${SITE_ADDRESS:-:80}"
BASIC_AUTH_USER="$(env_value BASIC_AUTH_USER)"

# ---- deploy/gateway.env from network/gateway-env.sh (paths only, no key material) ----
# A clean environment, so only what gateway-env.sh (and env.sh) export is dumped.
env -i HOME="$HOME" PATH="$PATH" bash -s >"$GW_ENV.tmp" <<'EOS' || die "could not read network/gateway-env.sh"
set -euo pipefail
source network/gateway-env.sh
echo "# Written by scripts/deploy.sh from network/gateway-env.sh. Paths only; mounted read-only."
for name in $(compgen -e | grep -E '^S14_([A-Z_]+_(MSP_ID|PEER_ENDPOINT|PEER_HOST_ALIAS|TLS_CERT|CERT|KEY)|CHANNEL|CHAINCODE)$' | sort); do
  value="${!name}"
  case "$value" in *"'"*|*$'\n'*) echo "deploy: $name contains a quote or a newline" >&2; exit 1 ;; esac
  printf "%s='%s'\n" "$name" "$value"
done
EOS
mv "$GW_ENV.tmp" "$GW_ENV"
chmod 600 "$GW_ENV"
while IFS= read -r line; do
  case "$line" in S14_*_TLS_CERT=*|S14_*_CERT=*|S14_*_KEY=*)
    path="${line#*=}"; path="${path#\'}"; path="${path%\'}"
    case "$path" in "$DRUNIX_ORGS_DIR"/*) ;; *) die "${line%%=*} is outside $DRUNIX_ORGS_DIR, which is the only directory mounted" ;; esac
    [ -r "$path" ] || die "${line%%=*}: $path is missing or unreadable (is the network up?)" ;;
  esac
done <"$GW_ENV"

# ---- ports: free unless our own services hold them ----
if [ -z "$(compose ps -q 2>/dev/null)" ]; then
  ports=("$GW_PORT" "$BACKEND_PORT")
  case "$SITE_ADDRESS" in :*) ports+=("${SITE_ADDRESS#:}") ;; *) ports+=(80 443) ;; esac
  for port in "${ports[@]}"; do
    ! curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$port" || die "port $port is already in use; stop that process first"
  done
fi

# ---- build and start ----
say "building and starting gateway, backend, web"
# --force-recreate: the gateway reads its keys once at start; after a new network they change.
fail() {
  echo "deploy: $*" >&2
  compose ps >&2 || true
  compose logs --tail 60 >&2 || true
  exit 1
}
compose up -d --build --force-recreate || fail "docker compose up failed"
if [ "$NETWORK_STARTED" = 1 ]; then say "network started in this run"; fi
wait_http() { # <name> <url>
  for _ in $(seq 1 90); do
    curl -fsS --max-time 3 "$2" >/dev/null 2>&1 && { say "$1 up"; return 0; }
    sleep 2
  done
  fail "$1 did not come up ($2)"
}
wait_http gateway "http://127.0.0.1:$GW_PORT/health"
wait_http backend "http://127.0.0.1:$BACKEND_PORT/health"

# ---- through Caddy ----
case "$SITE_ADDRESS" in
  :*) BASE="http://127.0.0.1:${SITE_ADDRESS#:}"; CURL_SITE=(curl -s --max-time 10)
      HOST_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
      PORT_SUFFIX=""; [ "${SITE_ADDRESS#:}" = 80 ] || PORT_SUFFIX="${SITE_ADDRESS}"
      PUBLIC_URL="http://${HOST_IP:-<this-vm>}${PORT_SUFFIX}/" ;;
  *)  BASE="https://$SITE_ADDRESS"; CURL_SITE=(curl -s --max-time 10 --resolve "$SITE_ADDRESS:443:127.0.0.1")
      PUBLIC_URL="https://$SITE_ADDRESS/" ;;
esac
site_code() { "${CURL_SITE[@]}" -o /dev/null -w '%{http_code}' "$@" || true; }
SITE_OK=0
for _ in $(seq 1 60); do
  [ "$(site_code "$BASE/")" = 401 ] && { SITE_OK=1; break; }
  sleep 2
done
if [ "$SITE_OK" = 1 ]; then
  say "site answers 401 without credentials"
  if [ -n "$PASSWORD" ]; then
    code="$(site_code -u "$BASIC_AUTH_USER:$PASSWORD" "$BASE/api/health")"
    [ "$code" = 200 ] || fail "GET /api/health with credentials gave HTTP $code"
    say "site answers /api/health with credentials"
  fi
else
  case "$SITE_ADDRESS" in
    :*) fail "the site did not answer 401 at $BASE/" ;;
    *)  echo "deploy: WARNING: https://$SITE_ADDRESS/ is not answering yet. Certificate issuance needs DNS pointing here and ports 80/443 open; see 'bash scripts/deploy.sh logs'." >&2 ;;
  esac
fi

echo
say "Receipt Book is at $PUBLIC_URL (user '$BASIC_AUTH_USER')"
if [ "$NEW_PASSWORD" = 1 ]; then
  echo "deploy: generated basic-auth password (shown ONCE, only its hash is stored): $PASSWORD"
fi
say "status: bash scripts/deploy.sh status | logs: bash scripts/deploy.sh logs | stop: bash scripts/deploy.sh down"
