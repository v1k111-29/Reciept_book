#!/usr/bin/env bash
# Start the Drunix test network and create our channel. OWNER: P3. Linux only (Drunix README).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"
cd "$DRUNIX_DIR/drunix-network/test-network"
./network.sh up createChannel -c "$S14_CHANNEL" -s "$S14_STATE_DB"
