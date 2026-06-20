import { defineConfig } from "drizzle-kit";

// drizzle-kit runs under plain Node, not Next — load the app env file ourselves.
// Migrations use the DIRECT connection (bypasses the pool, elevated privilege);
// it is referenced ONLY here, never in app code (root CLAUDE.md security rules).
process.loadEnvFile(".env.local");

const url = process.env.DIRECT_URL;
if (!url) {
  throw new Error("DIRECT_URL is required for migrations (set it in .env.local)");
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
