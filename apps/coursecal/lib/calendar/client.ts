import "server-only";

import { google } from "googleapis";
import { env } from "@/lib/env";

// The OAuth2 client for Calendar calls, built from a user's stored refresh token
// (ADR-008). google-auth-library refreshes the access token on demand, so the
// session access token is not used here. This module + sync.ts are the only place
// that talks to googleapis (apps/coursecal/CLAUDE.md).
export function calendarOAuthClient(refreshToken: string) {
  const client = new google.auth.OAuth2(env.AUTH_GOOGLE_ID, env.AUTH_GOOGLE_SECRET);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

export type CalendarOAuthClient = ReturnType<typeof calendarOAuthClient>;

// Best-effort revocation of Coursecal's own OAuth grant, on account deletion.
// revokeToken() posts the refresh token to Google's /revoke endpoint, which
// revokes the entire grant (and any derived access tokens) — a full disconnect.
// (revokeCredentials() can't be used: it only revokes an access token, which this
// refresh-token-only client doesn't hold.) Swallows failures — the common case is
// a grant the user already revoked — since deletion must never be blocked, and
// never logs the token.
export async function revokeGoogleGrant(refreshToken: string): Promise<void> {
  try {
    await calendarOAuthClient(refreshToken).revokeToken(refreshToken);
  } catch {
    // Already revoked / network error — deletion proceeds regardless.
  }
}
