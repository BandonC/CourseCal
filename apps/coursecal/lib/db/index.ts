import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Runtime DB client over the POOLED connection (DATABASE_URL). The direct
// connection (DIRECT_URL) is migrations-only and is never imported here
// (CLAUDE.md / root security rules). neon-http is stateless HTTP — no pool to
// manage per serverless invocation; multi-statement atomicity uses db.batch().
export const db = drizzle(env.DATABASE_URL, { schema });
