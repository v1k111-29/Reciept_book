#!/usr/bin/env bash
# Run every suite the way CI does. OWNER: P1. Usage: bash scripts/check_all.sh
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== python";    uv sync && uv run pytest -q
for pkg in chaincode gateway frontend; do
  echo "== $pkg"; (cd "$pkg" && npm ci --no-audit --no-fund && npm run typecheck && npm test)
done
echo "== all suites green"
