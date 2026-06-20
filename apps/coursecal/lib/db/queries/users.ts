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
