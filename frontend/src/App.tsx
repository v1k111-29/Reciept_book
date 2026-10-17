/**
 * App shell. OWNER: P5. Views to build (FEATURES.md E5, E7, E8):
 *   - Bank desk: create record, record DOCS_ACKNOWLEDGED / PAYMENT_RECEIVED / EDPMS_MARKED_OFF
 *   - Exporters' body desk: record EBRC_SELF_CERTIFIED and CUSTOMS_STATUS_OBSERVED
 *   - Timeline: one shipping bill's milestones + cause assessment (TimelineView)
 *   - Metrics: the three pilot measures (MetricsSummary)
 * All data comes from the backend via src/api.ts; never call the gateway or ledger directly.
 */
import { CONTRACTS_VERSION } from "./generated/contracts";

export function App() {
  return (
    <main>
      <h1>S14 Receipt Book</h1>
      <p>Shared milestone record per shipping bill (pilot). Contracts v{CONTRACTS_VERSION}.</p>
    </main>
  );
}
