/** Browser-side SHA-256 of a document or text. The file never leaves the browser. */

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(data: string | ArrayBuffer | Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("This browser cannot compute a SHA-256 fingerprint (WebCrypto needs a secure page).");
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  return toHex(await subtle.digest("SHA-256", bytes as BufferSource));
}

function readBytes(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as ArrayBuffer);
    r.onerror = () => reject(r.error ?? new Error("Could not read the file"));
    r.readAsArrayBuffer(blob);
  });
}

/** Lowercase SHA-256 hex (64 chars) of a file's bytes. */
export async function fileFingerprint(file: Blob): Promise<string> {
  return sha256Hex(await readBytes(file));
}

export function readText(blob: Blob): Promise<string> {
  if (typeof blob.text === "function") return blob.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("Could not read the file"));
    r.readAsText(blob);
  });
}
