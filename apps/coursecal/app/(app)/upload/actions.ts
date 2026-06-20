"use server";

import {
  parseSyllabus,
  type DryRunResult,
  type ParseResult,
} from "@coursecal/syllabus-parser";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { getOptionalUser } from "@/lib/auth/session";
import { countParsesSince, recordParse } from "@/lib/db/queries/parse-events";
import { ParseInputSchema } from "@/lib/parse/schema";

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
