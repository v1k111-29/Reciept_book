import { expect, it } from "vitest";
import { fileFingerprint, sha256Hex } from "../src/fingerprint";

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

it("sha256Hex matches the known vectors", async () => {
  expect(await sha256Hex("abc")).toBe(ABC);
  expect(await sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
});

it("fileFingerprint hashes the bytes of a file", async () => {
  const h = await fileFingerprint(new File(["abc"], "doc.pdf"));
  expect(h).toBe(ABC);
  expect(h).toMatch(/^[0-9a-f]{64}$/);
});
