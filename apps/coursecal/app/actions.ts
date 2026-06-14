"use server";

import {
  parseSyllabus,
  type DryRunResult,
  type ParseResult,
} from "@coursecal/syllabus-parser";
import { type ActionResult, actionErr, actionOk } from "@/lib/action-result";
import { ParseInputSchema } from "@/lib/parse/schema";

// Phase 2: this action runs UNAUTHENTICATED and without a per-user rate limit.
// The contract's auth()/userId-scoping and the Postgres rate-limit counter both
// depend on the auth + DB that arrive in Phase 3 (documented exception — see
// DECISIONS.md). The one real server-side control here is the 200k char cap in
// ParseInputSchema. The flow is local-only in Phase 2 — no public endpoint is
// exposed. TODO(phase-3): add auth() + userId scoping + DB-backed rate limit
// before any public deploy.

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
