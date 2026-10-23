#!/usr/bin/env bash
# Show the newest block on an org's COMMITTING peer: each transaction's endorsing MSPs and its
# validation code (VALID, ENDORSEMENT_POLICY_FAILURE, MVCC_READ_CONFLICT, ...). OWNER: P3.
#   bash network/last-block.sh <org 1|2>
# Lite peers keep no blocks (ISS-p3-6), so this asks the committing peer (cp.orgN). Used for the
# E3 endorsement test (P3-G3-T1).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/env.sh"
ORG="${1:?usage: last-block.sh <org 1|2>}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$DRUNIX_DIR/drunix-network/test-network"
export PATH="$PWD/../../build/bin:$PATH" FABRIC_CFG_PATH="$(cd ../config && pwd)"
set +eu # Drunix's envVar.sh is not written for strict mode
source ./scripts/envVar.sh >/dev/null 2>&1
setGlobals "$ORG" 1 >/dev/null 2>&1
set -eu
peer channel fetch newest "$TMP/block.pb" -c "$S14_CHANNEL" >/dev/null 2>&1
configtxlator proto_decode --type common.Block --input "$TMP/block.pb" --output "$TMP/block.json"
python3 -I - "$TMP/block.json" "$ORG" <<'PY'
import base64, json, re, sys
block = json.load(open(sys.argv[1]))
names = {0: "VALID", 10: "ENDORSEMENT_POLICY_FAILURE", 11: "MVCC_READ_CONFLICT", 12: "PHANTOM_READ_CONFLICT"}
flags = base64.b64decode(block["metadata"]["metadata"][2] or "")
for i, envelope in enumerate(block["data"]["data"]):
    tx = envelope["payload"]["header"]["channel_header"]["tx_id"]
    actions = envelope["payload"]["data"].get("actions") or []
    endorsements = actions[0]["payload"]["action"]["endorsements"] if actions else []
    msps = [re.search(r"Org\dMSP", base64.b64decode(e["endorser"]).decode("latin-1")).group(0) for e in endorsements]
    code = flags[i] if i < len(flags) else None
    print(f"cp.org{sys.argv[2]} block {block['header']['number']} tx {tx[:16]}... endorsed by {msps} -> {names.get(code, code)}")
PY
