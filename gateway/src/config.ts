/**
 * Gateway configuration from environment variables. OWNER: P3.
 *
 * One identity per OrgRole (contracts OrgRole). Roles in contracts DEFAULT_MSP_ROLES are required;
 * any other role (CUSTOMS_VIEWER) is optional, but once one of its variables is set, all are needed.
 * Pure: reads `env` only, opens no files and no connections.
 *
 *   S14_GATEWAY_PORT             default 8800
 *   S14_CHANNEL                  default "receiptbook"
 *   S14_CHAINCODE                default "receiptbook"
 *   S14_<ROLE>_MSP_ID            e.g. S14_AD_BANK_MSP_ID=Org1MSP (must agree with DEFAULT_MSP_ROLES)
 *   S14_<ROLE>_PEER_ENDPOINT     e.g. localhost:7051
 *   S14_<ROLE>_TLS_CERT          path to the peer's TLS CA cert
 *   S14_<ROLE>_CERT / _KEY       path to the client identity cert / private key
 *   S14_<ROLE>_PEER_HOST_ALIAS   optional TLS host name override, e.g. peer0.org1.example.com
 *
 * Drunix test network (U-02, docs/logs/p3.md 18 Oct 2026): both lite and committing peers serve the
 * Gateway API. Tested values, with paths under drunix-network/test-network/organizations/
 * peerOrganizations/orgN.example.com/:
 *   AD_BANK         Org1MSP  localhost:7051  alias peer0.org1.example.com
 *   EXPORTERS_BODY  Org2MSP  localhost:9051  alias peer0.org2.example.com
 *   TLS_CERT  peers/peer0.orgN.example.com/tls/ca.crt
 *   CERT      users/User1@orgN.example.com/msp/signcerts/User1@orgN.example.com-cert.pem
 *   KEY       users/User1@orgN.example.com/msp/keystore/priv_sk
 * (cryptogen's file names are fixed, so the paths survive network/down.sh + up.sh; the keys change.)
 */
import { DEFAULT_MSP_ROLES, OrgRole } from "./generated/contracts.js";

export interface IdentityConfig {
  mspId: string;
  peerEndpoint: string;
  tlsCertPath: string;
  certPath: string;
  keyPath: string;
  peerHostAlias?: string;
}

export interface GatewayConfig {
  port: number;
  channel: string;
  chaincode: string;
  identities: Partial<Record<OrgRole, IdentityConfig>>;
}

type Env = Record<string, string | undefined>;

const IDENTITY_VARS = {
  mspId: "MSP_ID",
  peerEndpoint: "PEER_ENDPOINT",
  tlsCertPath: "TLS_CERT",
  certPath: "CERT",
  keyPath: "KEY",
} as const;

const REQUIRED_ROLES: ReadonlySet<OrgRole> = new Set(Object.values(DEFAULT_MSP_ROLES));

/** Trimmed value, or undefined when unset or blank. */
function read(env: Env, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function readPort(env: Env): number {
  const raw = read(env, "S14_GATEWAY_PORT");
  if (raw === undefined) return 8800;
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`gateway config: S14_GATEWAY_PORT must be an integer 1-65535, got "${raw}"`);
  }
  return port;
}

/** Spec: test/config.spec.test.ts. Missing required variables -> throw Error naming them. */
export function loadConfig(env: Env = process.env): GatewayConfig {
  const port = readPort(env);
  const missing: string[] = [];
  const problems: string[] = [];
  const identities: Partial<Record<OrgRole, IdentityConfig>> = {};

  for (const role of Object.values(OrgRole)) {
    const name = (suffix: string) => `S14_${role}_${suffix}`;
    const values = Object.fromEntries(
      Object.entries(IDENTITY_VARS).map(([field, suffix]) => [field, read(env, name(suffix))]),
    ) as Record<keyof typeof IDENTITY_VARS, string | undefined>;
    const peerHostAlias = read(env, name("PEER_HOST_ALIAS"));

    const anySet = Object.values(values).some((v) => v !== undefined) || peerHostAlias !== undefined;
    if (!REQUIRED_ROLES.has(role) && !anySet) continue;

    const absent = Object.entries(IDENTITY_VARS).filter(([field]) => values[field as keyof typeof values] === undefined);
    if (absent.length > 0) {
      missing.push(...absent.map(([, suffix]) => name(suffix)));
      continue;
    }

    const mspId = values.mspId!;
    const mappedRole = DEFAULT_MSP_ROLES[mspId];
    if (mappedRole !== undefined && mappedRole !== role) {
      problems.push(`${name("MSP_ID")}=${mspId}, but DEFAULT_MSP_ROLES maps ${mspId} to ${mappedRole}`);
      continue;
    }

    identities[role] = {
      mspId,
      peerEndpoint: values.peerEndpoint!,
      tlsCertPath: values.tlsCertPath!,
      certPath: values.certPath!,
      keyPath: values.keyPath!,
      ...(peerHostAlias !== undefined && { peerHostAlias }),
    };
  }

  if (missing.length > 0) problems.unshift(`missing environment variables: ${missing.join(", ")}`);
  if (problems.length > 0) throw new Error(`gateway config: ${problems.join("; ")}`);

  return {
    port,
    channel: read(env, "S14_CHANNEL") ?? "receiptbook",
    chaincode: read(env, "S14_CHAINCODE") ?? "receiptbook",
    identities,
  };
}
