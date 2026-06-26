"use server";

import {
  parseSyllabus,
  type DryRunResult,
  type ParseError,
  type ParseResult,
  type Result,
} from "@coursecal/syllabus-parser";
import { z } from "zod";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { captureServer } from "@/lib/analytics/posthog-server";
import { getOptionalUser } from "@/lib/auth/session";
import { syncDeliverablesToCalendar, type SyncSummary } from "@/lib/calendar/export-sync";
import { courseColorForIndex } from "@/lib/courses/colors";
import { getCourseForReparse } from "@/lib/db/queries/courses";
import { getSyncableDeliverablesForSemester } from "@/lib/db/queries/deliverables";
import { countParsesSince, recordParse } from "@/lib/db/queries/parse-events";
import {
  addCoursesToSemester,
  createSemesterWithCourses,
} from "@/lib/db/queries/semesters";
import {
  AddCoursesInputSchema,
  ParseInputSchema,
  SaveSemesterInputSchema,
} from "@/lib/parse/schema";
import type { ParseTrigger } from "@/lib/analytics/events";
import type { CourseId, SemesterId, UserId } from "@/lib/db/ids";

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

// Emit the parse outcome (server-authoritative — counts and confidence buckets only,
// never titles/dates). Skips dryRun success (no real parse) and the DryRunResult
// shape, which carries no deliverables.
async function captureParseOutcome(
  userId: UserId,
  trigger: ParseTrigger,
  result: Result<ParseResult | DryRunResult, ParseError>,
): Promise<void> {
  if (!result.ok) {
    await captureServer(userId, {
      name: "syllabus_parse_failed",
      properties: { error_kind: result.error.kind, trigger },
    });
    return;
  }
  if (!("deliverables" in result.data)) return;
  const d = result.data.deliverables;
  await captureServer(userId, {
    name: "syllabus_parse_succeeded",
    properties: {
      deliverable_count: d.length,
      low_confidence_count: d.filter((x) => x.confidence === "low").length,
      medium_confidence_count: d.filter((x) => x.confidence === "medium").length,
      has_recurrence: d.some((x) => x.recurrence !== null),
      trigger,
    },
  });
}

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
      await captureServer(user.userId, {
        name: "syllabus_parse_failed",
        properties: { error_kind: "rate_limited", trigger: "upload" },
      });
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

  if (!dryRun) await captureParseOutcome(user.userId, "upload", result);

  if (!result.ok) {
    const message =
      PARSE_ERROR_MESSAGES[result.error.kind] ?? "Parsing failed. Please try again.";
    return actionErr(message, result.error.kind);
  }

  return actionOk(result.data);
}

// Re-parses a course's stored syllabus text (§7.1) for the replacement flow. Same
// cost guard as a normal parse — it's a real LLM call. The parse context is rebuilt
// server-side from the semester dates + the user's timezone; `today` is the current
// date in that timezone (en-CA formats as YYYY-MM-DD). Returns the fresh ParseResult
// for review; the actual swap is a separate action after the user confirms.
export async function reparseCourseAction(
  courseId: string,
): Promise<ActionResult<ParseResult>> {
  const user = await getOptionalUser();
  if (!user) {
    return actionErr("You must be signed in to re-parse.", "unauthenticated");
  }

  const parsed = z.uuid().safeParse(courseId);
  if (!parsed.success) {
    return actionErr("Invalid course.", "invalid_input");
  }

  const ctx = await getCourseForReparse(user.userId, parsed.data as CourseId);
  if (!ctx) return actionErr("Course not found.", "not_found");

  const recent = await countParsesSince(user.userId, new Date(Date.now() - DAY_MS));
  if (recent >= MAX_PARSES_PER_DAY) {
    await captureServer(user.userId, {
      name: "syllabus_parse_failed",
      properties: { error_kind: "rate_limited", trigger: "reparse" },
    });
    return actionErr(
      "You've reached the daily limit of syllabus parses. Try again tomorrow.",
      "rate_limited",
    );
  }
  await recordParse(user.userId);

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ctx.timezone }).format(
    new Date(),
  );
  const result = await parseSyllabus(ctx.syllabusText, {
    semesterStart: ctx.semesterStart,
    semesterEnd: ctx.semesterEnd,
    today,
    timezone: ctx.timezone,
  });

  await captureParseOutcome(user.userId, "reparse", result);

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
    await captureServer(user.userId, {
      name: "semester_saved",
      properties: {
        course_count: courses.length,
        deliverable_count: courses.reduce((s, c) => s + c.result.deliverables.length, 0),
        is_add_to_existing: false,
      },
    });
    return actionOk(ids);
  } catch {
    // Raw DB errors may leak schema/state — return a safe message (Sentry will
    // capture the real error server-side once wired in a later phase).
    return actionErr("Couldn't save your semester. Please try again.", "save_failed");
  }
}

// Adds reviewed course(s) to an existing semester (§3.3). Re-validates each
// client-edited ParseResult against the library schema and scopes the write to the
// owner; returns the semester id so the flow can run the (resumable) export.
export async function addCoursesToSemesterAction(
  input: unknown,
): Promise<ActionResult<{ semesterId: SemesterId; courseIds: CourseId[] }>> {
  const user = await getOptionalUser();
  if (!user) {
    return actionErr("You must be signed in to add courses.", "unauthenticated");
  }

  const parsed = AddCoursesInputSchema.safeParse(input);
  if (!parsed.success) {
    return actionErr("The course or syllabus details are invalid.", "invalid_input");
  }

  try {
    const result = await addCoursesToSemester(
      user.userId,
      parsed.data.semesterId as SemesterId,
      parsed.data.courses.map((c) => ({ result: c.result, syllabusText: c.syllabusText })),
    );
    if (!result) return actionErr("Semester not found.", "not_found");
    await captureServer(user.userId, {
      name: "semester_saved",
      properties: {
        course_count: parsed.data.courses.length,
        deliverable_count: parsed.data.courses.reduce(
          (s, c) => s + c.result.deliverables.length,
          0,
        ),
        is_add_to_existing: true,
      },
    });
    return actionOk(result);
  } catch {
    return actionErr("Couldn't add the courses. Please try again.", "save_failed");
  }
}

// Syncs all of a saved semester's dated, not-yet-synced deliverables (across every
// course) to Google Calendar via the shared chunked exporter. Resumable: each
// success writes back its google_event_id, so re-running skips synced rows.
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

  const rows = (
    await getSyncableDeliverablesForSemester(user.userId, parsed.data as SemesterId)
  ).filter((d): d is typeof d & { dueDate: string } => d.dueDate !== null);

  const summary = await syncDeliverablesToCalendar(user.userId, rows);
  await captureServer(user.userId, {
    name: "calendar_export_completed",
    properties: {
      created: summary.created,
      failed: summary.failed,
      reconnect_needed: summary.reconnectNeeded,
    },
  });
  return actionOk(summary);
}
