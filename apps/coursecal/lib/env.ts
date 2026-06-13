import "server-only";
import { z } from "zod";

// Server-side environment contract. Validated once at startup via
// instrumentation.ts (fail fast — see COURSECAL.md §9.5). This module is
// server-only: never import it from a client component.
//
// NEXT_PUBLIC_* vars are inlined into the client bundle by Next at build time;
// they're validated here as optional, but client code reads them directly from
// process.env, not from this module.

const envSchema = z.object({
  // Neon Postgres — pooled (runtime) and direct (migrations only).
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),

  // Auth.js + Google OAuth.
  AUTH_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),

  // Anthropic. Model is optional — falls back to a code default when unset.
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).optional(),

  // Refresh-token encryption (AES-256-GCM): 32 bytes as 64 hex chars.
  TOKEN_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "must be 64 hex characters (openssl rand -hex 32)"),

  // Observability — optional until launch.
  NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().min(1).optional(),
});

// Treat empty strings as unset — a blank `KEY=` line in .env.local means "not
// provided", so optional vars pass and required vars fail with a clear message.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === "" ? undefined : value]),
);

const parsed = envSchema.safeParse(rawEnv);

if (!parsed.success) {
  // Surface key names only — never the values, which are secrets.
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration (check apps/coursecal/.env.local):\n${issues}`,
  );
}

export const env = parsed.data;
