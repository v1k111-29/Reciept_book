#!/usr/bin/env bash
# Stop the network and remove its containers and crypto material. OWNER: P3.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"
cd "$DRUNIX_DIR/drunix-network/test-network"
./network.sh down
