/** SPEC for src/config.ts. OWNER: P3. Change it.fails -> it when implemented. */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const env = {
  S14_AD_BANK_MSP_ID: "Org1MSP", S14_AD_BANK_PEER_ENDPOINT: "localhost:7051",
  S14_AD_BANK_TLS_CERT: "/t1", S14_AD_BANK_CERT: "/c1", S14_AD_BANK_KEY: "/k1",
  S14_EXPORTERS_BODY_MSP_ID: "Org2MSP", S14_EXPORTERS_BODY_PEER_ENDPOINT: "localhost:9051",
  S14_EXPORTERS_BODY_TLS_CERT: "/t2", S14_EXPORTERS_BODY_CERT: "/c2", S14_EXPORTERS_BODY_KEY: "/k2",
};

describe("loadConfig (P3, G1)", () => {
  it("reads defaults and both identities", () => {
    const c = loadConfig(env);
    expect([c.port, c.channel, c.chaincode]).toEqual([8800, "receiptbook", "receiptbook"]);
    expect(c.identities.AD_BANK?.mspId).toBe("Org1MSP");
    expect(c.identities.EXPORTERS_BODY?.peerEndpoint).toBe("localhost:9051");
  });
  it("names the missing variable", () => {
    const { S14_AD_BANK_KEY: _drop, ...partial } = env;
    expect(() => loadConfig(partial)).toThrow(/S14_AD_BANK_KEY/);
  });
});
