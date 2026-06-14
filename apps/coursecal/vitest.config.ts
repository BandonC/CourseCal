import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

// Unit tests cover the pure app logic (recurrence expansion, ics build, action
// input validation). Components/server actions aren't tested here. The "@/" alias
// mirrors tsconfig so tests import the same way app code does.
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    passWithNoTests: true,
  },
});
