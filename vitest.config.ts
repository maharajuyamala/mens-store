import { defineConfig } from "vitest/config";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  // Inline, empty PostCSS so Vite does not try to load the app's Tailwind
  // postcss.config.mjs (irrelevant to pure-logic unit tests).
  css: {
    postcss: { plugins: [] },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
