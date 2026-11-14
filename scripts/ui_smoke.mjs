// UI smoke test against the running demo (docs/RUNBOOK.md step 4).
// Drives a real browser through the four steps the runbook lists: create a record on the bank
// desk, record PAYMENT_RECEIVED on it, open the timeline, check the metrics view. Screenshots go
// to $S14_UI_SHOTS (default .demo-logs/ui). Needs `playwright` resolvable from this process, e.g.
//   npm i --no-save --prefix "$RUNNER_TEMP/pw" playwright@1.49.1 && npx --prefix "$RUNNER_TEMP/pw" playwright install chromium
//   NODE_PATH="$RUNNER_TEMP/pw/node_modules" node scripts/ui_smoke.mjs
// All values typed are synthetic.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.S14_UI_URL ?? "http://localhost:5173";
const SHOTS = process.env.S14_UI_SHOTS ?? ".demo-logs/ui";
mkdirSync(SHOTS, { recursive: true });

const ident = Date.now().toString(36).toUpperCase();
const browser = await chromium.launch();
const page = await browser.newPage();
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
const step = (msg) => console.log(`ui: ${msg}`);
const pageErrors = [];
page.on("pageerror", (err) => pageErrors.push(err.message));
page.on("console", (msg) => msg.type() === "error" && pageErrors.push(msg.text()));

try {
  await page.goto(BASE);
  await page.getByRole("heading", { name: "Bank desk" }).waitFor();

  step("create a record on the bank desk");
  const create = page.getByRole("form", { name: "Create record" });
  await create.getByLabel("Shipping bill number").fill(`SYN-UI-${ident}`);
  await create.getByLabel("Port code").fill("INMAA1");
  await create.getByLabel("Shipping bill date").fill("2026-10-01");
  await create.getByRole("button", { name: "Create record" }).click();
  const created = page.getByRole("status").filter({ hasText: /Record created: [0-9a-f]{64}/ });
  await created.waitFor({ timeout: 30_000 });
  const sbHash = (await created.textContent()).match(/[0-9a-f]{64}/)[0];
  step(`created ${sbHash}`);
  await shot("1-created");

  step("record PAYMENT_RECEIVED on it");
  await page.getByRole("button", { name: "PAYMENT RECEIVED", exact: true }).click();
  const ms = page.getByRole("form", { name: "Record milestone" });
  await ms.getByLabel("Occurred on").fill("2026-10-05");
  await ms.getByLabel(/Reference/).fill(`SYNTHETIC-IRM-${ident}`);
  await ms.getByRole("button", { name: "Record milestone" }).click();
  await page.getByRole("status").filter({ hasText: /Recorded in transaction \S+/ }).waitFor({ timeout: 30_000 });
  step(`recorded: ${await page.getByRole("status").textContent()}`);
  await shot("2-payment");

  step("open the timeline");
  await page.getByRole("navigation", { name: "Main views" }).getByRole("button", { name: "Timeline" }).click();
  const timeline = page.getByRole("region", { name: "Shipping bill timeline" });
  // The timeline shows a hash's first 12 characters; the new record opens on its own (focus).
  const article = timeline.getByRole("article").filter({ hasText: `Shipping bill: ${sbHash.slice(0, 12)}` });
  await article.getByText("PAYMENT RECEIVED", { exact: true }).waitFor({ timeout: 30_000 });
  await article.getByText("Occurred on: 2026-10-05", { exact: true }).waitFor();
  step(`timeline: ${(await article.textContent()).replace(/\s+/g, " ").slice(0, 300)}`);
  await shot("3-timeline");

  step("live indicator");
  await page.locator(".live-status").filter({ hasText: /^Live/ }).waitFor({ timeout: 30_000 });

  step("reference check: right reference matches, wrong one does not");
  const check = article.getByRole("form", { name: "Check a document or reference" });
  const verdict = article.getByTestId("reference-check-result");
  await check.getByLabel("Milestone to check").selectOption("PAYMENT_RECEIVED");
  await check.getByLabel("Raw reference to check").fill(`SYNTHETIC-IRM-${ident}`);
  await check.getByRole("button", { name: "Check against the ledger" }).click();
  await verdict.filter({ hasText: /^Matches the ledger/ }).waitFor({ timeout: 30_000 });
  await check.getByLabel("Raw reference to check").fill(`SYNTHETIC-IRM-${ident}-X`);
  await check.getByRole("button", { name: "Check against the ledger" }).click();
  await verdict.filter({ hasText: "Does NOT match the ledger" }).waitFor({ timeout: 30_000 });
  await shot("3b-reference-check");

  step("Customs import: one known shipping bill, one unknown");
  await page.getByRole("navigation", { name: "Main views" }).getByRole("button", { name: "Customs import" }).click();
  await page.getByLabel("Or paste CSV text").fill(
    [
      "sb_number,port_code,sb_date,customs_status,observed_on",
      `SYN-UI-${ident},INMAA1,2026-10-01,PENDING,2026-10-20`,
      `SYN-UI-${ident}-N,INMAA1,2026-10-01,PENDING,2026-10-20`,
    ].join("\n"),
  );
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: /^Send 2 rows to the ledger/ }).click();
  const imported = page.getByRole("region", { name: "Import result" });
  await imported.getByText("1 recorded, 1 not found, 0 failed (of 2).").waitFor({ timeout: 60_000 });
  // The import's own chaincode event must reach the browser over /events.
  await page.locator(".live-status").filter({ hasText: /Customs status observed/i }).waitFor({ timeout: 30_000 });
  await shot("3c-customs-import");

  step("check the metrics view");
  await page.getByRole("navigation", { name: "Main views" }).getByRole("button", { name: "Metrics" }).click();
  const metrics = page.getByRole("region", { name: "Pilot metrics" });
  await metrics.waitFor();
  // No "networkidle" wait: the /events stream keeps one connection open for good.
  await metrics.getByText(/^Records in demo: \d+$/).or(metrics.getByRole("alert")).first().waitFor({ timeout: 30_000 });
  if (await metrics.getByRole("alert").count()) throw new Error(`metrics error: ${await metrics.getByRole("alert").textContent()}`);
  await metrics.getByText(/^Records in demo: \d+$/).waitFor({ timeout: 30_000 });
  const text = (await metrics.textContent()).replace(/\s+/g, " ");
  const count = Number(text.match(/Records in demo: (\d+)/)[1]);
  if (count < 31) throw new Error(`metrics count ${count}, expected at least 31 (30 seeded + 1 here)`);
  if (/NaN|undefined|null/.test(text)) throw new Error(`metrics shows an empty value: ${text}`);
  step(`metrics: ${text.slice(0, 400)}`);
  await shot("4-metrics");
  if (pageErrors.length) throw new Error(`browser errors: ${pageErrors.join(" | ")}`);
  step("PASS");
} catch (err) {
  await shot("failure").catch(() => {});
  console.error(`ui: FAIL ${err.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
