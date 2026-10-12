import { defineConfig } from "@playwright/test";

/**
 * Phase 0 harness config. No webServer: the golden-path spec opens the
 * static export straight from `file://` (out/index.html), which is the
 * whole point of G3 — the demo must work double-clicked, with no server.
 */
export default defineConfig({
  testDir: "./scripts",
  fullyParallel: false,
  timeout: 60_000,
  reporter: "line",
  use: {
    headless: true,
  },
});
