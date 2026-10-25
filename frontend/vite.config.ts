import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Backend (P4) runs on :8000; the dev server and `vite preview` both proxy /api to it,
// stripping the prefix (ISS-p5-1). Any other static host needs the same rewrite.
const apiProxy = { "/api": { target: "http://localhost:8000", rewrite: (p: string) => p.replace(/^\/api/, "") } };

export default defineConfig({
  plugins: [react()],
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
  test: { environment: "jsdom", globals: true, include: ["test/**/*.test.{ts,tsx}"], setupFiles: ["test/setup.ts"] },
});
