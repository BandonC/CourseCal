"use server";

import {
  parseSyllabus,
  type DryRunResult,
  type ParseResult,
} from "@coursecal/syllabus-parser";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { getOptionalUser } from "@/lib/auth/session";
import { ParseInputSchema } from "@/lib/parse/schema";

// Authenticated parse action. The Phase-2 exception (unauthenticated, no rate
// limit — see DECISIONS.md) is now half-closed: every call requires a session.
// The per-user rate limit lands in chunk 4 alongside the save action and its
// parse_events counter table. The 200k char cap (ParseInputSchema) still applies.

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
