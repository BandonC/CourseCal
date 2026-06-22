"use server";

import {
  parseSyllabus,
  type DryRunResult,
  type ParseResult,
} from "@coursecal/syllabus-parser";
import { z } from "zod";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { getOptionalUser } from "@/lib/auth/session";
import { buildCalendarEvent } from "@/lib/calendar/event";
import { calendarOAuthClient } from "@/lib/calendar/client";
import { insertEvent } from "@/lib/calendar/sync";
import { courseColorForIndex } from "@/lib/courses/colors";
import {
  getSyncableDeliverablesForSemester,
  setGoogleEventId,
} from "@/lib/db/queries/deliverables";
import { countParsesSince, recordParse } from "@/lib/db/queries/parse-events";
import { createSemesterWithCourses } from "@/lib/db/queries/semesters";
import { clearRefreshToken, getDecryptedRefreshToken } from "@/lib/db/queries/users";
import { ParseInputSchema, SaveSemesterInputSchema } from "@/lib/parse/schema";
import type { CourseId, SemesterId } from "@/lib/db/ids";

// Calendar export tuning: insert several events concurrently (apps/coursecal/
// CLAUDE.md — naive serial is too slow; no batch endpoint).
const SYNC_CONCURRENCY = 6;

// Authenticated, rate-limited parse action — the Phase-2 exception
// (unauthenticated, no rate limit — see DECISIONS.md) is now fully closed: every
// call requires a session, and real (non-dryRun) parses are capped per user per
// day. The 200k char cap (ParseInputSchema) still applies.

// Cost guard (§13.2): cap the expensive LLM call per user per rolling 24h.
const MAX_PARSES_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

// User-safe messages keyed by the library's typed ParseError.kind. We never
// surface raw library or model messages to the client (root CLAUDE.md security).
const PARSE_ERROR_MESSAGES: Record<string, string> = {
  empty_input: "The syllabus text is empty.",
  input_too_large: "This syllabus is too long to parse. Try trimming it.",
  llm_error: "The parser couldn't process this syllabus. Please try again.",
  invalid_response: "The parser returned an unexpected result. Please try again.",
};

export async function parseSyllabusAction(
  input: unknown,
): Promise<ActionResult<ParseResult | DryRunResult>> {
  const user = await getOptionalUser();
  if (!user) {
    return actionErr("You must be signed in to parse a syllabus.", "unauthenticated");
  }

  const parsed = ParseInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr(
      "The submitted syllabus or semester details are invalid.",
      "invalid_input",
    );
  }

  const { text, context, dryRun } = parsed.data;

  // dryRun makes no LLM call (free), so it bypasses the cost guard. The
  // count-then-record is intentionally non-atomic — a rare concurrent
  // over-count is acceptable for a cost guard (no Redis; root contract).
  if (!dryRun) {
    const recent = await countParsesSince(user.userId, new Date(Date.now() - DAY_MS));
    if (recent >= MAX_PARSES_PER_DAY) {
      return actionErr(
        "You've reached the daily limit of syllabus parses. Try again tomorrow.",
        "rate_limited",
      );
    }
    await recordParse(user.userId);
  }

  const result = dryRun
    ? await parseSyllabus(text, context, { dryRun: true })
    : await parseSyllabus(text, context);

  if (!result.ok) {
    const message =
      PARSE_ERROR_MESSAGES[result.error.kind] ?? "Parsing failed. Please try again.";
    return actionErr(message, result.error.kind);
  }

  return actionOk(result.data);
}

// Persists the reviewed semester + its courses + (expanded) deliverables. The
// client sends its edited ParseResults; the server re-validates each against the
// library schema before saving (never trust the client). Each course gets a
// distinct timeline color by its index. Returns the semester id so the export +
// timeline flow can read the rows back.
export async function saveSemesterAction(
  input: unknown,
): Promise<ActionResult<{ semesterId: SemesterId; courseIds: CourseId[] }>> {
  const user = await getOptionalUser();
  if (!user) {
    return actionErr("You must be signed in to save.", "unauthenticated");
  }

  const parsed = SaveSemesterInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr("The semester or syllabus details are invalid.", "invalid_input");
  }

  const { semesterName, semesterStart, semesterEnd, courses } = parsed.data;

  try {
    const ids = await createSemesterWithCourses(user.userId, {
      semesterName,
      semesterStart,
      semesterEnd,
      courses: courses.map((c, i) => ({
        result: c.result,
        syllabusText: c.syllabusText,
        color: courseColorForIndex(i),
      })),
    });
    return actionOk(ids);
  } catch {
    // Raw DB errors may leak schema/state — return a safe message (Sentry will
    // capture the real error server-side once wired in a later phase).
    return actionErr("Couldn't save your semester. Please try again.", "save_failed");
  }
}

type SyncSummary = { created: number; failed: number; reconnectNeeded: boolean };

// Syncs all of a saved semester's dated, not-yet-synced deliverables (across every
// course) to Google Calendar. Resumable: google_event_id is written back per
// success, so re-running skips rows already created. Revoked consent clears the
// stored token and signals the reconnect flow.
export async function exportSemesterToCalendarAction(
  semesterId: string,
): Promise<ActionResult<SyncSummary>> {
  const user = await getOptionalUser();
  if (!user) {
    return actionErr("You must be signed in to export.", "unauthenticated");
  }

  const parsed = z.uuid().safeParse(semesterId);
  if (!parsed.success) {
    return actionErr("Invalid semester.", "invalid_input");
  }
  const sid = parsed.data as SemesterId;

  const refreshToken = await getDecryptedRefreshToken(user.userId);
  if (!refreshToken) {
    return actionOk({ created: 0, failed: 0, reconnectNeeded: true });
  }

  const rows = (await getSyncableDeliverablesForSemester(user.userId, sid)).filter(
    (d): d is typeof d & { dueDate: string } => d.dueDate !== null,
  );
  if (rows.length === 0) {
    return actionOk({ created: 0, failed: 0, reconnectNeeded: false });
  }

  const auth = calendarOAuthClient(refreshToken);
  let created = 0;
  let failed = 0;
  let reconnectNeeded = false;

  for (let i = 0; i < rows.length && !reconnectNeeded; i += SYNC_CONCURRENCY) {
    const chunk = rows.slice(i, i + SYNC_CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map(async (d) => {
        const event = buildCalendarEvent({
          courseLabel: d.courseCode ?? d.courseName,
          title: d.title,
          dueDate: d.dueDate,
          dueTime: d.dueTime,
          weightPercent: d.weightPercent,
          notes: d.notes,
          confidence: d.confidence,
          ambiguityReason: d.ambiguityReason,
          timezone: d.timezone,
        });
        const outcome = await insertEvent(auth, event);
        if (outcome.kind === "ok") {
          await setGoogleEventId(d.id, outcome.eventId);
        }
        return outcome;
      }),
    );
    for (const o of outcomes) {
      if (o.kind === "ok") created++;
      else if (o.kind === "reconnect") reconnectNeeded = true;
      else failed++;
    }
  }

  if (reconnectNeeded) {
    await clearRefreshToken(user.userId);
  }

  return actionOk({ created, failed, reconnectNeeded });
}
