#!/usr/bin/env bash
# One-command demo: clean network -> deploy chaincode -> gateway -> backend -> seed -> UI.
# Run on the HOST MACHINE that runs the Drunix network, from a fresh clone:
#   bash scripts/demo.sh
# Needs: network/env.sh (copy of network/env.example.sh), docker, uv, node, npm.
# Untested on a live network from this checkout (no Drunix host here): run it on the host
# machine and keep the output as evidence (the team logs were removed; see git history) before G4 is declared.
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
cleanup() { # kill each background job and its children (npm -> node, uv -> uvicorn)
  for p in "${PIDS[@]:-}"; do
    [ -n "$p" ] || continue
    pkill -TERM -P "$p" 2>/dev/null || true
    kill "$p" 2>/dev/null || true
  done
}
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
GW_PORT="${S14_GATEWAY_PORT:-8800}"
for port in "$GW_PORT" 8000 5173; do
  ! curl -s -o /dev/null "http://localhost:$port" || { echo "demo: port $port already in use; stop the old process first" >&2; exit 1; }
done
(cd gateway && exec npm run dev >"$LOGS/gateway.log" 2>&1) &
PIDS+=($!)
wait_for gateway "http://localhost:$GW_PORT/health"

echo "== backend"
# No salt in git (AGENTS.md section 8): a fresh random salt per demo run unless one is set.
# A fresh network is seeded each run, so hashes need not be stable across runs.
export S14_HASH_SALT="${S14_HASH_SALT:-$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')}"
# pyproject.toml has package = false: s14 is importable only with backend/ on the path.
export PYTHONPATH="$ROOT/backend${PYTHONPATH:+:$PYTHONPATH}"
uv run uvicorn s14.api:app --app-dir backend --port 8000 >"$LOGS/backend.log" 2>&1 &
PIDS+=($!)
wait_for backend "http://localhost:8000/health"

echo "== seed (synthetic demo data)"
if [ "${S14_DEMO_HEADLESS:-0}" = 1 ]; then
  # CI (.github/workflows/live.yml): a failed seed fails the run. The UI runs in the background
  # only while S14_DEMO_CHECK (a command, e.g. the UI smoke test) runs; its status is ours.
  uv run python -m s14.seed --count 30 --backend http://localhost:8000
  (cd frontend && exec npm run dev -- --port 5173 --strictPort >"$LOGS/frontend.log" 2>&1) &
  PIDS+=($!)
  wait_for UI "http://localhost:5173"
  echo "== headless check: ${S14_DEMO_CHECK:-none}"
  if [ -n "${S14_DEMO_CHECK:-}" ]; then bash -c "$S14_DEMO_CHECK"; fi
  exit 0
fi
uv run python -m s14.seed --count 30 --backend http://localhost:8000 || echo "demo: seed reported errors (see above); UI still starts" >&2

echo "== UI at http://localhost:5173 (Ctrl-C stops everything)"
(cd frontend && npm run dev -- --host)
