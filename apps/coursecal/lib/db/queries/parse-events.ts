import "server-only";

import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import type { UserId } from "@/lib/db/ids";
import { parseEvents } from "@/lib/db/schema";

// Parse rate limit (§13.2). Counts attempts (incl. failures) in a trailing
// window; the action records an event before each LLM call.

export async function countParsesSince(userId: UserId, since: Date): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(parseEvents)
    .where(and(eq(parseEvents.userId, userId), gte(parseEvents.createdAt, since)));
  return row?.n ?? 0;
}

export async function recordParse(userId: UserId): Promise<void> {
  await db.insert(parseEvents).values({ userId });
}
