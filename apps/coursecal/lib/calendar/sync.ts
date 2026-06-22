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

// Patch by stored google_event_id (apps/coursecal/CLAUDE.md — never create-on-
// update). A 404 means the event was deleted in Google Calendar by hand; the
// caller offers to recreate rather than failing silently (§6.4).
export type PatchOutcome =
  | { kind: "ok" }
  | { kind: "notFound" }
  | { kind: "reconnect" }
  | { kind: "failed" };

// Delete is idempotent: a 404/410 means the event is already gone in Google,
// which is the desired end state, so it counts as success (§7.3 cascade).
export type DeleteOutcome =
  | { kind: "ok" }
  | { kind: "reconnect" }
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

// Revoked consent / dead refresh token → reconnect. A 401 surfaces only after
// google-auth-library already tried to refresh, so it's terminal.
function isReconnect(status: number | null, reason: string | null): boolean {
  return (
    reason === "invalid_grant" || reason === "insufficientPermissions" || status === 401
  );
}

// Runs one Calendar call with exponential backoff on the retryable signals
// (429/5xx and the quota-signalling 403 reasons). Non-retryable errors return
// their classification so each wrapper maps its own terminal cases (404,
// reconnect). The retry policy lives here once, shared by insert/patch/delete.
async function runWithBackoff<T>(
  op: () => Promise<T>,
): Promise<
  { ok: true; value: T } | { ok: false; status: number | null; reason: string | null }
> {
  for (let attempt = 0; ; attempt++) {
    try {
      return { ok: true, value: await op() };
    } catch (err) {
      const { status, reason } = classifyError(err);
      const retryable =
        status === 429 ||
        (status != null && status >= 500) ||
        reason === "rateLimitExceeded" ||
        reason === "userRateLimitExceeded";
      if (retryable && attempt < MAX_RETRIES) {
        await sleep(backoffMs(attempt));
        continue;
      }
      return { ok: false, status, reason };
    }
  }
}

export async function insertEvent(
  auth: CalendarOAuthClient,
  event: calendar_v3.Schema$Event,
): Promise<InsertOutcome> {
  const calendar = google.calendar({ version: "v3", auth });
  const r = await runWithBackoff(() =>
    calendar.events.insert({ calendarId: "primary", requestBody: event }),
  );
  if (r.ok) {
    return r.value.data.id ? { kind: "ok", eventId: r.value.data.id } : { kind: "failed" };
  }
  return isReconnect(r.status, r.reason) ? { kind: "reconnect" } : { kind: "failed" };
}

// Patch an existing event by its stored id. `event` is a partial — Google merges
// it — so callers send either a full rebuilt event (deliverable edit) or just the
// changed field, e.g. { summary } on a course rename.
export async function patchEvent(
  auth: CalendarOAuthClient,
  eventId: string,
  event: calendar_v3.Schema$Event,
): Promise<PatchOutcome> {
  const calendar = google.calendar({ version: "v3", auth });
  const r = await runWithBackoff(() =>
    calendar.events.patch({ calendarId: "primary", eventId, requestBody: event }),
  );
  if (r.ok) return { kind: "ok" };
  if (isReconnect(r.status, r.reason)) return { kind: "reconnect" };
  if (r.status === 404) return { kind: "notFound" };
  return { kind: "failed" };
}

export async function deleteEvent(
  auth: CalendarOAuthClient,
  eventId: string,
): Promise<DeleteOutcome> {
  const calendar = google.calendar({ version: "v3", auth });
  const r = await runWithBackoff(() =>
    calendar.events.delete({ calendarId: "primary", eventId }),
  );
  if (r.ok) return { kind: "ok" };
  if (isReconnect(r.status, r.reason)) return { kind: "reconnect" };
  // Already gone in Google (manually deleted) — the desired end state.
  if (r.status === 404 || r.status === 410) return { kind: "ok" };
  return { kind: "failed" };
}
