import "server-only";

import { eq } from "drizzle-orm";
import { decryptToken, encryptToken } from "@/lib/auth/crypto";
import { db } from "@/lib/db";
import type { UserId } from "@/lib/db/ids";
import { users } from "@/lib/db/schema";

// User persistence (ADR-008 — the app owns the users table; no Auth.js adapter).
// The refresh token is the only secret here and it is encrypted before it ever
// reaches the DB; the decrypted form is returned only to lib/calendar.

type UpsertUserInput = {
  googleId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
};

/** Upsert keyed on google_id (sign-in). Returns the app's UserId. */
export async function upsertUserByGoogleId(input: UpsertUserInput): Promise<UserId> {
  const [row] = await db
    .insert(users)
    .values({
      googleId: input.googleId,
      email: input.email,
      name: input.name,
      imageUrl: input.imageUrl,
    })
    .onConflictDoUpdate({
      target: users.googleId,
      set: {
        email: input.email,
        name: input.name,
        imageUrl: input.imageUrl,
        updatedAt: new Date(),
      },
    })
    .returning({ id: users.id });

  if (!row) {
    throw new Error("user upsert returned no row");
  }
  return row.id;
}

export async function getUserById(userId: UserId) {
  const [row] = await db.select().from(users).where(eq(users.id, userId));
  return row ?? null;
}

/**
 * Hard-delete the user and everything under them. The FK cascade (§7.3) removes
 * semesters → courses → deliverables and parse_events; the encrypted refresh
 * token goes with the users row. Calendar events live in Google, not the DB
 * cascade — the caller removes those first (account action).
 */
export async function deleteUser(userId: UserId): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * The user's own data for the export (§14, data portability). Their identity and
 * their nested semesters/courses/deliverables — no internal ids, no
 * google_event_id, and never google_id or the encrypted refresh token. This
 * payload is PII (email, name, syllabus text); it is returned only to the user
 * and must never be logged or sent to analytics/Sentry.
 */
export async function getUserExport(userId: UserId) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true, name: true, timezone: true, createdAt: true },
    with: {
      semesters: {
        columns: { name: true, startDate: true, endDate: true, createdAt: true },
        with: {
          courses: {
            columns: {
              name: true,
              code: true,
              instructor: true,
              originalSyllabusText: true,
              createdAt: true,
            },
            with: {
              deliverables: {
                columns: {
                  title: true,
                  type: true,
                  dueDate: true,
                  dueTime: true,
                  weightPercent: true,
                  notes: true,
                  confidence: true,
                  ambiguityReason: true,
                  seriesId: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

/** Persist the refresh token encrypted (the one capture moment — ADR-008). */
export async function setEncryptedRefreshToken(
  userId: UserId,
  refreshToken: string,
): Promise<void> {
  await db
    .update(users)
    .set({ encryptedRefreshToken: encryptToken(refreshToken), updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Mark Calendar tokens invalid on revoked consent — the reconnect flow recovers. */
export async function clearRefreshToken(userId: UserId): Promise<void> {
  await db
    .update(users)
    .set({ encryptedRefreshToken: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Decrypted refresh token for Calendar calls, or null if none is stored. */
export async function getDecryptedRefreshToken(userId: UserId): Promise<string | null> {
  const [row] = await db
    .select({ enc: users.encryptedRefreshToken })
    .from(users)
    .where(eq(users.id, userId));
  return row?.enc ? decryptToken(row.enc) : null;
}
