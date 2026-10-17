import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Backend (P4) runs on :8000; the dev server proxies /api to it.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://localhost:8000", rewrite: (p) => p.replace(/^\/api/, "") } } },
  test: { environment: "jsdom", globals: true, include: ["test/**/*.test.{ts,tsx}"], setupFiles: ["test/setup.ts"] },
});
