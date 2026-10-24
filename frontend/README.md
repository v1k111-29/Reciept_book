# Frontend (React, Vite, TypeScript)

The browser UI for the S14 Receipt Book pilot. It lets a bank clerk and an exporters' body
clerk record milestones for a shipping bill, and lets anyone see the timeline, the likely
cause of a Customs "pending", and the pilot metrics. It talks only to the backend, never to
the gateway or Drunix. It moves no money and replaces no government system.

All data in the demo is synthetic. The header says "pilot, synthetic data" and the
timeline view says "Synthetic demo data."

## Views

The nav bar switches between four views in `src/App.tsx`.

| View | What it does |
|---|---|
| Bank desk | Create a record (shipping bill number, port code, date). Record milestones as `AD_BANK`. |
| Exporters' desk | Record milestones as `EXPORTERS_BODY`. |
| Timeline | Lists records from the backend, or looks one up by hash. Shows milestones in `ledger_time` order, who signed, and the cause bucket in plain words. |
| Metrics | Shows the three pilot measures. A missing measure reads "Not enough data". |

Each desk lists only the milestones whose `WRITER_ROLE` is that desk's role. So the bank
desk shows docs acknowledged, payment received and EDPMS marked off. The exporters' desk
shows eBRC self-certified and Customs status observed. The chaincode still enforces the
rule; the UI just does not offer a button that would fail.

The reference field appears only for milestones in `REFERENCE_REQUIRED`. The raw value is
sent to the backend, which hashes it. The Customs status select appears only for
`CUSTOMS_STATUS_OBSERVED`.

## API client

`src/api.ts` has one function per backend route: `createRecord`, `recordMilestone`,
`getTimeline`, `listRecords`, `getMetrics`. Paths follow `BACKEND_ROUTES` under the `/api`
prefix. `App` takes an optional `api` prop, so tests can pass a fake.

A non-2xx reply throws `ApiError`. Its `code` is the contract `ErrorCode` from the backend's
`ErrorBody`, its `status` is the HTTP status, and its `message` is the backend's message. If the
body is not JSON the code is `INTERNAL`. If `fetch` itself fails the code is `NETWORK` and
the status is 0. The views show errors as `CODE: message`.

## Dev proxy

The backend routes have no `/api` prefix. `vite.config.ts` proxies `/api` to
`http://localhost:8000` and strips the prefix, so start the backend on port 8000 first. The
proxy exists only in the Vite dev server. A built `dist/` served by a plain file server has
no proxy and would need the same rewrite (open item ISS-p5-1 in `docs/logs/p5.md`).

## Commands

```bash
cd frontend
npm ci
npm run dev          # Vite dev server, usually http://localhost:5173
npm run typecheck    # tsc --noEmit
npm test             # vitest run (jsdom)
npm run build        # tsc --noEmit, then vite build into dist/
```

`scripts/demo.sh` starts the whole stack and then runs `npm run dev -- --host`.

## Tests

In `test/`. `App.test.tsx` renders the views against a fake `Api`. It checks desk
milestones per role, a milestone submit, the error code on a rejected write, timeline
order, plain-word causes and the "Not enough data" case. `api.spec.test.ts` mocks `fetch` and
checks paths, methods and `ApiError`. `parity.test.ts` checks the TypeScript contracts
against the schema.

## Generated contracts

`src/generated/` (`contracts.ts`, `contracts.schema.json`, `parity.ts`) is copied from
`contracts/` by `scripts/sync_ts_contracts.sh`. Never hand-edit it. If the parity test goes
red, do not change the test or the copy. Log a contract issue for p1.
