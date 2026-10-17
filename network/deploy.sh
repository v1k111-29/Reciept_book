#!/usr/bin/env bash
# Build and deploy our TypeScript chaincode. OWNER: P3 (chaincode code itself is P2's).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"
CC_PATH="$(cd "$HERE/../chaincode" && pwd)"
cd "$DRUNIX_DIR/drunix-network/test-network"
./network.sh deployCC -c "$S14_CHANNEL" -ccn "$S14_CHAINCODE" -ccp "$CC_PATH" -ccl typescript \
  -ccep "$S14_ENDORSEMENT_POLICY"
