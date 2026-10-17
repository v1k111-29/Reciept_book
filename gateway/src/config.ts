/**
 * Gateway configuration from environment variables. OWNER: P3.
 *
 * One identity per OrgRole (contracts OrgRole). For the Drunix test network the paths
 * point into drunix-network/test-network/organizations/... (verify at G1, docs/UNKNOWNS.md U-02).
 *
 *   S14_GATEWAY_PORT          default 8800
 *   S14_CHANNEL               default "receiptbook"
 *   S14_CHAINCODE             default "receiptbook"
 *   S14_<ROLE>_MSP_ID         e.g. S14_AD_BANK_MSP_ID=Org1MSP
 *   S14_<ROLE>_PEER_ENDPOINT  e.g. localhost:7051 (which Drunix peer serves the Gateway API is U-02)
 *   S14_<ROLE>_TLS_CERT       path to the peer's TLS CA cert
 *   S14_<ROLE>_CERT / _KEY    path to the client identity cert / private key
 */
export interface IdentityConfig {
  mspId: string;
  peerEndpoint: string;
  tlsCertPath: string;
  certPath: string;
  keyPath: string;
}

export interface GatewayConfig {
  port: number;
  channel: string;
  chaincode: string;
  identities: Partial<Record<"AD_BANK" | "EXPORTERS_BODY" | "CUSTOMS_VIEWER", IdentityConfig>>;
}

/** Spec: test/config.spec.test.ts. Missing required variables -> throw Error naming them. */
export function loadConfig(env: Record<string, string | undefined> = process.env): GatewayConfig {
  throw new Error("NotImplemented: P3 G1");
}
