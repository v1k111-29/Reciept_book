/**
 * Gateway entry point. OWNER: P3. `npm run dev` (tsx) or `node dist/main.js` after `npm run build`.
 * Settings come from S14_* environment variables (config.ts). For the test network:
 *   source network/gateway-env.sh && (cd gateway && npm run dev)
 */
import { loadConfig } from "./config.js";
import { FabricLedger } from "./ledger/fabric.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const ledger = await FabricLedger.connect(config);
  const server = buildServer(ledger).listen(config.port, () => {
    const roles = Object.entries(config.identities).map(([role, id]) => `${role}=${id.mspId}@${id.peerEndpoint}`);
    console.log(`gateway on :${config.port} | channel ${config.channel} | chaincode ${config.chaincode} | ${roles.join(" ")}`);
  });
  const shutdown = () => {
    server.close(() => {
      ledger.close();
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((err: unknown) => {
  console.error((err as Error).message ?? err);
  process.exit(1);
});
