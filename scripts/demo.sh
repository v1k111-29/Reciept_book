#!/usr/bin/env bash
# One-command demo: clean network -> deploy chaincode -> gateway -> backend -> seed -> UI.
# OWNER: P1 (P1-G4-T1). Run on the HOST MACHINE that runs the Drunix network, from a fresh clone:
#   bash scripts/demo.sh
# Needs: network/env.sh (copy of network/env.example.sh), docker, uv, node, npm.
# Untested on a live network from this checkout (no Drunix host here): run it on the host
# machine and log the output in docs/logs/INTEGRATION_LOG.md before G4 is declared.
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"
LOGS="$ROOT/.demo-logs"
mkdir -p "$LOGS"

[ -f network/env.sh ] || { echo "demo: network/env.sh missing. cp network/env.example.sh network/env.sh and edit it." >&2; exit 1; }
for cmd in docker uv node npm curl; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "demo: required command '$cmd' not found" >&2; exit 127; }
done

PIDS=()
cleanup() { for p in "${PIDS[@]:-}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT INT TERM

wait_for() { # <name> <url>
  for _ in $(seq 1 60); do
    curl -fsS "$2" >/dev/null 2>&1 && { echo "demo: $1 up"; return 0; }
    sleep 2
  done
  echo "demo: $1 did not come up, see $LOGS" >&2
  return 1
}

echo "== network: clean, up, deploy"
bash network/down.sh || true
bash network/up.sh
bash network/deploy.sh

echo "== install"
uv sync
(cd gateway && npm ci --no-audit --no-fund)
(cd frontend && npm ci --no-audit --no-fund)

echo "== gateway"
# shellcheck source=/dev/null
source network/gateway-env.sh
(cd gateway && npm run dev >"$LOGS/gateway.log" 2>&1) &
PIDS+=($!)
wait_for gateway "http://localhost:${S14_GATEWAY_PORT:-8800}/health"

echo "== backend"
# Demo-only salt. Real salts never go in git (AGENTS.md section 8).
export S14_HASH_SALT="${S14_HASH_SALT:-demo-salt-synthetic-data-only}"
uv run uvicorn s14.api:app --port 8000 >"$LOGS/backend.log" 2>&1 &
PIDS+=($!)
wait_for backend "http://localhost:8000/health"

echo "== seed (synthetic demo data)"
uv run python -m s14.seed --count 30 --backend http://localhost:8000

echo "== UI at http://localhost:5173 (Ctrl-C stops everything)"
(cd frontend && npm run dev -- --host)
