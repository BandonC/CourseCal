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
