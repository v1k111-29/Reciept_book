# HOST_RUNBOOK.md: closing G2, G3 and G4 on the host machine

*Owner: p1. Written 25 Oct 2026. Everything here needs a machine that runs the Drunix network
(U-11; p3's or p2's Mac in the logs). Run the steps in order and paste each output into the log
named.*

**Without a host machine (D-33):** `.github/workflows/live.yml` runs steps 1 to 4 on a
GitHub-hosted Linux runner: it builds the Drunix binaries at the pinned commit, brings the network
up, deploys `receiptbook`, runs the live suite, `scripts/e3_endorsement_check.sh`, and
`scripts/demo.sh` headless with the UI smoke test (`scripts/ui_smoke.mjs`). It runs on a push to
a `p1/g2-live-*` branch or by hand (`gh workflow run live.yml --ref develop`). The evidence is the
run's `live-evidence` artifact (logs, container logs, UI screenshots).

## 0. Before you start

```bash
git checkout develop && git pull --ff-only
git config --get s14.id                  # your id; tags and develop are lead-only
bash scripts/check_all.sh                # must end "all suites green"
```

`network/env.sh` must exist (copy `network/env.example.sh`). Per D-27, rebuild the network after
the host has slept, and run p3's health check in `network/README.md`.

## 1. Fresh network with our chaincode (DEP-p3-2, P2-G2-T1 deploy)

```bash
bash network/down.sh && bash network/up.sh && bash network/deploy.sh
```

A fresh network takes `--sequence 1`. A network that already has `receiptbook` 1.0 needs a new
version and sequence 2 (`docs/logs/p2.md`, P2-G2-T1). Log the `querycommitted` output in
`docs/logs/p3.md`.

## 2. Live suite (P1-G2-T1, P1-G3-T1, E1, E2, E4, E9, E10)

```bash
source network/gateway-env.sh && (cd gateway && npm run dev) &      # gateway on :8800
S14_LIVE=1 uv run pytest tests/integration -v
```

The `needs_g2` / `needs_g3` strict-xfail markers came off on 25 Oct 2026, after every live test
passed on Drunix in `live.yml` (D-33). Every live test must now pass.

A test that fails is a real bug. Log it as an ISS with the output and assign it to the owner
of the failing side. `test_rejects_other_bank_wrong_bank` stays skipped until N2 (a second bank org).

## 3. E3 on our chaincode (DEP-p3-3, P3-G3-T1)

`bash scripts/e3_endorsement_check.sh` does the steps below and exits non-zero if the result is
wrong.

Repeat p3's 22 Oct negative test (`docs/logs/p3.md`, done on the `basic` sample) on
`receiptbook`: submit a `CreateRecord` endorsed by Org1's peer only. Expect it to be ordered, then
marked `ENDORSEMENT_POLICY_FAILURE`, with no record created. Read the result with
`bash network/last-block.sh 1`, which shows the validation code. Log the command and output in
`docs/logs/p3.md`.

## 4. Demo and seed (P1-G4-T1, P4-G3-T3, DEP-p4-1, DEP-p5-2)

```bash
bash scripts/demo.sh
```

It brings the network down, up and deploys it, starts the gateway and the backend, seeds 30
synthetic records, and serves the UI on http://localhost:5173. Check that the seed prints
`loaded 30/30` and that "on ledger by cause bucket" shows 6 for each of the five buckets. Log
that in `docs/logs/p4.md`.

In the UI:
- Create a record on the bank desk.
- Record PAYMENT_RECEIVED on it.
- Open the timeline.
- Check the metrics view.

Log what you saw in `docs/logs/p5.md` and the script output in `docs/logs/INTEGRATION_LOG.md`.

## 5. Declare and tag (P1-G4-T2)

When steps 2 to 4 are green:
1. Write the gate-close entries (G2, G3, G4) in `docs/logs/INTEGRATION_LOG.md` by PR.
2. Tag the verified develop SHA, as in `docs/GIT_WORKFLOW.md` "Gate close":

```bash
git tag -a g2 <sha> -m "Gate G2 close" && git push origin g2
git tag -a g3 <sha> -m "Gate G3 close" && git push origin g3
git tag -a v1.0.0 <sha> -m "S14 Receipt Book v1.0.0 (G4 demo freeze)" && git push origin v1.0.0
```

Only after G3 is declared: the non-essential features N1 to N10 may start, in `FEATURES.md` order.
N1 first needs U-08's live test (`docs/UNKNOWNS.md`, which has the command).
