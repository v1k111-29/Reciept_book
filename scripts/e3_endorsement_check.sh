#!/usr/bin/env bash
# E3 / P3-G3-T1 on our own chaincode: a CreateRecord endorsed by ONE org must be ordered but
# invalidated at commit (ENDORSEMENT_POLICY_FAILURE) and create nothing; the same write endorsed
# by BOTH orgs must commit. OWNER: P1. Run on the host machine after network/up.sh and
# network/deploy.sh:
#   bash scripts/e3_endorsement_check.sh
# Exits non-zero if either result is not what the endorsement policy (D-05) promises.
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

invoke() { # <sb_hash> <peer args...>
  local h=$1; shift
  peer chaincode invoke "${ORDERER[@]}" -C "$S14_CHANNEL" -n "$S14_CHAINCODE" "$@" \
    -c "{\"function\":\"CreateRecord\",\"Args\":[\"$h\"]}" 2>&1 | tail -1
}
last_code() { # <org> -> validation code of the newest transaction on that org's committing peer
  bash "$ROOT/network/last-block.sh" "$1" | tee /dev/stderr | tail -1 | sed 's/.*-> //'
}
exists() { # <sb_hash> -> "yes" if GetRecord finds it (evaluated on the lite peer)
  if peer chaincode query -C "$S14_CHANNEL" -n "$S14_CHAINCODE" \
      -c "{\"function\":\"GetRecord\",\"Args\":[\"$1\"]}" >/dev/null 2>&1; then echo yes; else echo no; fi
}
wait_commit() { sleep "${S14_E3_WAIT:-6}"; } # lite peers send no commit events (network/README.md)

fail=0
ONE=$(rand_hash)
echo "== negative: CreateRecord $ONE endorsed by Org1MSP only"
invoke "$ONE" "${ORG1[@]}"
wait_commit
for org in 1 2; do
  code=$(last_code "$org")
  [ "$code" = "ENDORSEMENT_POLICY_FAILURE" ] || { echo "E3 FAIL: cp.org$org says $code" >&2; fail=1; }
done
[ "$(exists "$ONE")" = "no" ] || { echo "E3 FAIL: record $ONE exists after a one-org write" >&2; fail=1; }

BOTH=$(rand_hash)
echo "== control: CreateRecord $BOTH endorsed by Org1MSP and Org2MSP"
invoke "$BOTH" "${ORG1[@]}" "${ORG2[@]}"
wait_commit
for org in 1 2; do
  code=$(last_code "$org")
  [ "$code" = "VALID" ] || { echo "E3 FAIL: control on cp.org$org says $code" >&2; fail=1; }
done
[ "$(exists "$BOTH")" = "yes" ] || { echo "E3 FAIL: control record $BOTH not found" >&2; fail=1; }

[ "$fail" = 0 ] && echo "E3 PASS: one-org write invalidated, two-org write committed" || exit 1
