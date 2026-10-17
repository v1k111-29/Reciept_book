# network/ (owner: P3)

Wraps NPCI's Drunix sample network. Facts below are from the Drunix test-network README
(read by an AI tool on 15 Oct 2026, not yet by a person): Linux only; needs git, Docker,
Go, jq and Bash 4+; `./network.sh prereq` installs binaries and images; 2 peer orgs, each
with one committing peer, one lite peer and one validation server; one Raft orderer;
chaincode in Go, Java, JavaScript or TypeScript; default state DB YugabyteDB.

```bash
git clone https://github.com/npci/drunix ~/drunix
cd ~/drunix/drunix-network/test-network && ./network.sh prereq
cp network/env.example.sh network/env.sh   # edit DRUNIX_DIR
bash network/up.sh
bash network/deploy.sh
bash network/down.sh
```

Open questions P3 must close at G1 (docs/UNKNOWNS.md): U-02 which peer serves the Fabric
Gateway API; U-03 does `deployCC` accept `-ccep` and `-ccl typescript`; U-04 can the state DB
be switched away from YugabyteDB; U-05 does `-c receiptbook` work or must we use `mychannel`.
Record every finding in docs/logs/p3.md.
