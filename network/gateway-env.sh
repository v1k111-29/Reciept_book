# Source this to set the gateway's S14_* variables for the Drunix test network.
#   source network/gateway-env.sh && (cd gateway && npm run dev)
# Paths only (no keys in git): cryptogen regenerates the files on every network/up.sh, but their
# names stay the same. Values tested on 18-21 Oct 2026 (U-02).
_S14_NET_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
# shellcheck source=/dev/null
source "$_S14_NET_DIR/env.sh"   # DRUNIX_DIR, S14_CHANNEL, S14_CHAINCODE
_S14_ORGS="$DRUNIX_DIR/drunix-network/test-network/organizations/peerOrganizations"

_s14_identity() { # <ROLE> <org number> <MSP id> <lite peer port>
  local role=$1 n=$2 msp=$3 port=$4 org="$_S14_ORGS/org$2.example.com"
  export "S14_${role}_MSP_ID=$msp"
  export "S14_${role}_PEER_ENDPOINT=localhost:$port"
  export "S14_${role}_PEER_HOST_ALIAS=peer0.org$n.example.com"
  export "S14_${role}_TLS_CERT=$org/peers/peer0.org$n.example.com/tls/ca.crt"
  export "S14_${role}_CERT=$org/users/User1@org$n.example.com/msp/signcerts/User1@org$n.example.com-cert.pem"
  export "S14_${role}_KEY=$org/users/User1@org$n.example.com/msp/keystore/priv_sk"
}
_s14_identity AD_BANK 1 Org1MSP 7051          # lite peer lp1.org1
_s14_identity EXPORTERS_BODY 2 Org2MSP 9051   # lite peer lp1.org2
export S14_CHANNEL S14_CHAINCODE
unset -f _s14_identity
unset _S14_NET_DIR _S14_ORGS
