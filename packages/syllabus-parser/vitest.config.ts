import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // No tests yet in the Phase 0 scaffold; Phase 1 adds the real suite.
    passWithNoTests: true,
  },
});
