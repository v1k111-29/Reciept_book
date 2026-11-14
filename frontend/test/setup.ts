import "@testing-library/jest-dom/vitest";

// jsdom may not expose crypto.subtle; use Node's WebCrypto so the real code path is tested.
// @ts-ignore node types are not installed in this package
import { webcrypto } from "node:crypto";
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
