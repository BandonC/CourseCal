import "server-only";

import { google, type calendar_v3 } from "googleapis";
import type { CalendarOAuthClient } from "./client";

// Single event insert with exponential backoff and error classification
// (apps/coursecal/CLAUDE.md): retry on 429/5xx and the quota-signalling 403
// reasons; route revoked consent to reconnect; fail other 4xx without retry.

export type InsertOutcome =
  | { kind: "ok"; eventId: string }
  | { kind: "reconnect" } // revoked consent — caller marks tokens invalid
  | { kind: "failed" };

const MAX_RETRIES = 3;

function classifyError(err: unknown): { status: number | null; reason: string | null } {
  const e = err as {
    code?: number | string;
    status?: number;
    response?: {
      status?: number;
      data?: { error?: string | { errors?: { reason?: string }[] } };
    };
  };
  const status =
    typeof e.code === "number" ? e.code : (e.status ?? e.response?.status ?? null);

  const dataErr = e.response?.data?.error;
  let reason: string | null = null;
  if (typeof dataErr === "string") {
    reason = dataErr; // OAuth token endpoint: "invalid_grant"
  } else if (dataErr && Array.isArray(dataErr.errors)) {
    reason = dataErr.errors[0]?.reason ?? null; // Calendar: "rateLimitExceeded", …
  }
  return { status, reason };
}

function backoffMs(attempt: number): number {
  // 0.5s, 1s, 2s + jitter.
  return 500 * 2 ** attempt + Math.floor(Math.random() * 250);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function insertEvent(
  auth: CalendarOAuthClient,
  event: calendar_v3.Schema$Event,
): Promise<InsertOutcome> {
  const calendar = google.calendar({ version: "v3", auth });

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });
      return res.data.id ? { kind: "ok", eventId: res.data.id } : { kind: "failed" };
    } catch (err) {
      const { status, reason } = classifyError(err);

      // Revoked consent / dead refresh token → reconnect. A 401 surfaces only
      // after google-auth-library already tried to refresh, so it's terminal.
      if (reason === "invalid_grant" || reason === "insufficientPermissions" || status === 401) {
        return { kind: "reconnect" };
      }

      const retryable =
        status === 429 ||
        (status != null && status >= 500) ||
        reason === "rateLimitExceeded" ||
        reason === "userRateLimitExceeded";
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return { kind: "failed" };
    }
  }
}
