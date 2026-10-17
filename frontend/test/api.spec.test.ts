/** SPEC for src/api.ts and views. OWNER: P5. Turn each todo into a real test when you build it. */
describe("api client (P5)", () => {
  it.todo("createRecord POSTs to /api/records and returns sb_hash (G2)");
  it.todo("recordMilestone POSTs to /api/records/{sb_hash}/milestones (G2)");
  it.todo("getTimeline GETs /api/records/{sb_hash} and returns a TimelineView (G2)");
  it.todo("an error body {code, message} is thrown as an Error carrying the ErrorCode (G2)");
  it.todo("getMetrics GETs /api/metrics (G3)");
});
describe("views (P5)", () => {
  it.todo("Timeline lists milestones in ledger_time order with submitter role (G2)");
  it.todo("Timeline shows the cause bucket in plain words, e.g. DOWNSTREAM_SYNC (G3)");
  it.todo("Bank desk only offers the milestones WRITER_ROLE allows for AD_BANK (G3)");
  it.todo("Metrics view shows 'not enough data' for null measures (G3)");
});
