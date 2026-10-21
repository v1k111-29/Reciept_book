#!/usr/bin/env bash
# Run every suite the way CI does. OWNER: P1. Usage: bash scripts/check_all.sh
# Needs uv, node and npm on PATH in this Bash (Git Bash, WSL or Linux).
set -euo pipefail
cd "$(dirname "$0")/.."
for cmd in uv node npm; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "check_all: required command '$cmd' not found on PATH" >&2; exit 127; }
done
# One command per line: set -e ignores failures on the left of '&&'.
echo "== python"
uv sync
uv run pytest -q
for pkg in chaincode gateway frontend; do
  echo "== $pkg"
  (
    cd "$pkg"
    npm ci --no-audit --no-fund
    npm run typecheck
    npm test
  )
done
echo "== all suites green"
