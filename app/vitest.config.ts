import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Unit tests only (`lib/**`). Playwright specs (`scripts/*.spec.ts`) run
 *  under `npm run verify:file`, never under vitest. */
export default defineConfig({
  resolve: {
    // Same `@/*` mapping as tsconfig.json (needed for lib/data.ts JSON imports).
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/**/*.test.ts", "lib/types.ts", "lib/data.ts"],
    },
  },
});
