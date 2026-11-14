/** Extra tests for src/config.ts beyond the spec. OWNER: P3. */
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const env = {
  S14_AD_BANK_MSP_ID: "Org1MSP", S14_AD_BANK_PEER_ENDPOINT: "localhost:7051",
  S14_AD_BANK_TLS_CERT: "/t1", S14_AD_BANK_CERT: "/c1", S14_AD_BANK_KEY: "/k1",
  S14_EXPORTERS_BODY_MSP_ID: "Org2MSP", S14_EXPORTERS_BODY_PEER_ENDPOINT: "localhost:9051",
  S14_EXPORTERS_BODY_TLS_CERT: "/t2", S14_EXPORTERS_BODY_CERT: "/c2", S14_EXPORTERS_BODY_KEY: "/k2",
};

const customs = {
  S14_CUSTOMS_VIEWER_MSP_ID: "Org3MSP", S14_CUSTOMS_VIEWER_PEER_ENDPOINT: "localhost:11051",
  S14_CUSTOMS_VIEWER_TLS_CERT: "/t3", S14_CUSTOMS_VIEWER_CERT: "/c3", S14_CUSTOMS_VIEWER_KEY: "/k3",
};

describe("loadConfig (P3, extra)", () => {
  it("reads a custom port, channel and chaincode", () => {
    const c = loadConfig({ ...env, S14_GATEWAY_PORT: "9900", S14_CHANNEL: "mychannel", S14_CHAINCODE: "basic" });
    expect([c.port, c.channel, c.chaincode]).toEqual([9900, "mychannel", "basic"]);
  });

  it("reads S14_GATEWAY_HOST when set and leaves host out otherwise", () => {
    expect(loadConfig({ ...env, S14_GATEWAY_HOST: " 127.0.0.1 " }).host).toBe("127.0.0.1");
    expect(loadConfig(env)).not.toHaveProperty("host");
    expect(loadConfig({ ...env, S14_GATEWAY_HOST: "  " })).not.toHaveProperty("host");
  });

  it.each(["abc", "0", "70000", "80.5"])("rejects port %s, naming S14_GATEWAY_PORT", (port) => {
    expect(() => loadConfig({ ...env, S14_GATEWAY_PORT: port })).toThrow(/S14_GATEWAY_PORT/);
  });

  it("names every missing variable in one error", () => {
    const { S14_AD_BANK_KEY: _k, S14_EXPORTERS_BODY_CERT: _c, ...partial } = env;
    expect(() => loadConfig(partial)).toThrow(/S14_AD_BANK_KEY.*S14_EXPORTERS_BODY_CERT/);
  });

  it("treats a blank value as missing", () => {
    expect(() => loadConfig({ ...env, S14_AD_BANK_TLS_CERT: "  " })).toThrow(/S14_AD_BANK_TLS_CERT/);
  });

  it("leaves CUSTOMS_VIEWER out when none of its variables are set", () => {
    expect(loadConfig(env).identities.CUSTOMS_VIEWER).toBeUndefined();
  });

  it("reads CUSTOMS_VIEWER when all of its variables are set", () => {
    expect(loadConfig({ ...env, ...customs }).identities.CUSTOMS_VIEWER?.mspId).toBe("Org3MSP");
  });

  it("names CUSTOMS_VIEWER's missing variables when it is partly set", () => {
    expect(() => loadConfig({ ...env, S14_CUSTOMS_VIEWER_MSP_ID: "Org3MSP" })).toThrow(
      /S14_CUSTOMS_VIEWER_PEER_ENDPOINT/,
    );
  });

  it("rejects an MSP id that DEFAULT_MSP_ROLES maps to another role", () => {
    expect(() => loadConfig({ ...env, S14_AD_BANK_MSP_ID: "Org2MSP" })).toThrow(/S14_AD_BANK_MSP_ID=Org2MSP/);
  });

  it("accepts an MSP id that DEFAULT_MSP_ROLES does not list", () => {
    expect(loadConfig({ ...env, S14_AD_BANK_MSP_ID: "Org9MSP" }).identities.AD_BANK?.mspId).toBe("Org9MSP");
  });

  it("reads PEER_HOST_ALIAS when set and leaves it out otherwise", () => {
    const c = loadConfig({ ...env, S14_AD_BANK_PEER_HOST_ALIAS: "peer0.org1.example.com" });
    expect(c.identities.AD_BANK?.peerHostAlias).toBe("peer0.org1.example.com");
    expect(c.identities.EXPORTERS_BODY).not.toHaveProperty("peerHostAlias");
  });
});
