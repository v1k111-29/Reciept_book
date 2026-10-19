# Copy to network/env.sh (gitignored) and edit. OWNER: P3.
export DRUNIX_DIR="$HOME/drunix"                     # your clone of github.com/npci/drunix
export S14_CHANNEL="receiptbook"
export S14_CHAINCODE="receiptbook"
# Endorsement policy: both orgs must endorse every write (decision D-05). Flag support in
# Drunix's network.sh is unverified (docs/UNKNOWNS.md U-03).
export S14_ENDORSEMENT_POLICY="AND('Org1MSP.peer','Org2MSP.peer')"
# State database: keep yugabyte (U-04 decided 18 Oct 2026, docs/logs/p3.md REQ-p3-3). Drunix's
# compose files hard-code it for every peer. Revisit only if issue #8 (SQL+Redis writes) bites.
export S14_STATE_DB="yugabyte"
