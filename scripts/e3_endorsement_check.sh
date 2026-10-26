#!/usr/bin/env bash
# E3 / P3-G3-T1 on our own chaincode: a CreateRecord endorsed by ONE org must be ordered but
# invalidated at commit (ENDORSEMENT_POLICY_FAILURE) and create nothing; the same write endorsed
# by BOTH orgs must commit. OWNER: P1. Run on the host machine after network/up.sh and
# network/deploy.sh:
#   bash scripts/e3_endorsement_check.sh
# Exits non-zero if either result is not what the endorsement policy (D-05) promises. Nothing else
# may write to the channel while it runs: it reads the newest block after the height goes up.
# The hashes are random synthetic test values, not derived from any shipping bill.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT/network/env.sh"
cd "$DRUNIX_DIR/drunix-network/test-network"
export PATH="$PWD/../../build/bin:$PATH" FABRIC_CFG_PATH="$(cd ../config && pwd)"
set +eu # Drunix's envVar.sh is not written for strict mode
source ./scripts/envVar.sh >/dev/null 2>&1
setGlobals 1 0 >/dev/null 2>&1 # Org1 (AD bank, CREATE_RECORD_ROLE), lite peer
set -eu

rand_hash() { od -An -N32 -tx1 /dev/urandom | tr -d ' \n'; }
ORDERER=(-o localhost:7050 --ordererTLSHostnameOverride orderer.example.com --tls --cafile "$ORDERER_CA")
ORG1=(--peerAddresses localhost:7051 --tlsRootCertFiles "$PEER0_ORG1_CA")
ORG2=(--peerAddresses localhost:9051 --tlsRootCertFiles "$PEER0_ORG2_CA")
WAIT="${S14_E3_WAIT:-60}"

invoke() { # <sb_hash> <peer args...>
  local h=$1; shift
  peer chaincode invoke "${ORDERER[@]}" -C "$S14_CHANNEL" -n "$S14_CHAINCODE" "$@" \
    -c "{\"function\":\"CreateRecord\",\"Args\":[\"$h\"]}" 2>&1 | tail -1
}
height() { # block height on org 1's committing peer, or 0 if it cannot be read
  local h
  h=$(set +eu; setGlobals 1 1 >/dev/null 2>&1
      peer channel getinfo -c "$S14_CHANNEL" 2>/dev/null | grep -o '"height":[0-9]*' | cut -d: -f2)
  echo "${h:-0}"
}
wait_commit() { # <height before the invoke>: wait for a new block; fail after $WAIT seconds
  # Lite peers send no commit events (network/README.md), so watch the committing peer's height.
  for _ in $(seq 1 "$WAIT"); do
    [ "$(height)" -gt "$1" ] && { sleep 1; return 0; } # 1 s more for cp.org2 to catch up
    sleep 1
  done
  echo "E3 FAIL: no new block within ${WAIT}s" >&2
  exit 1
}
last_code() { # <org> -> validation code of the newest transaction on that org's committing peer
  bash "$ROOT/network/last-block.sh" "$1" | tee /dev/stderr | tail -1 | sed 's/.*-> //'
}
exists() { # <sb_hash> -> "yes" (found) or "no" (NOT_FOUND); any other query failure prints nothing
  local out
  if out=$(peer chaincode query -C "$S14_CHANNEL" -n "$S14_CHAINCODE" \
      -c "{\"function\":\"GetRecord\",\"Args\":[\"$1\"]}" 2>&1); then
    echo yes
  elif grep -q "NOT_FOUND" <<<"$out"; then
    echo no
  else
    echo "E3: GetRecord $1 failed: $out" >&2
  fi
}

fail=0
ONE=$(rand_hash)
echo "== negative: CreateRecord $ONE endorsed by Org1MSP only"
before=$(height)
invoke "$ONE" "${ORG1[@]}"
wait_commit "$before"
for org in 1 2; do
  code=$(last_code "$org")
  [ "$code" = "ENDORSEMENT_POLICY_FAILURE" ] || { echo "E3 FAIL: cp.org$org says $code" >&2; fail=1; }
done
[ "$(exists "$ONE")" = "no" ] || { echo "E3 FAIL: record $ONE exists or could not be read after a one-org write" >&2; fail=1; }

BOTH=$(rand_hash)
echo "== control: CreateRecord $BOTH endorsed by Org1MSP and Org2MSP"
before=$(height)
invoke "$BOTH" "${ORG1[@]}" "${ORG2[@]}"
wait_commit "$before"
for org in 1 2; do
  code=$(last_code "$org")
  [ "$code" = "VALID" ] || { echo "E3 FAIL: control on cp.org$org says $code" >&2; fail=1; }
done
[ "$(exists "$BOTH")" = "yes" ] || { echo "E3 FAIL: control record $BOTH not found" >&2; fail=1; }

[ "$fail" = 0 ] && echo "E3 PASS: one-org write invalidated, two-org write committed" || exit 1
