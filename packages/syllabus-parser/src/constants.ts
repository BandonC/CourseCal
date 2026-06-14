// Library-wide constants. The model id is overridable via ANTHROPIC_MODEL (§9.5);
// the default matches the §4.1 stack ("Claude Sonnet") and the §13.2 cost model.

export const DEFAULT_MODEL = "claude-sonnet-4-6";

/** Resolve the model id, preferring ANTHROPIC_MODEL when set and non-empty. */
export function resolveModel(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.ANTHROPIC_MODEL?.trim();
  return fromEnv ? fromEnv : DEFAULT_MODEL;
}

/** Output-token ceiling for one extraction. Non-streaming; bump if syllabi truncate. */
export const DEFAULT_MAX_TOKENS = 16_000;

/** Hard cap on submitted syllabus length; mirrors the app's server-action cap. */
export const MAX_SYLLABUS_CHARS = 200_000;

export const EXTRACT_TOOL_NAME = "extract_syllabus";
export const EXTRACT_TOOL_DESCRIPTION =
  "Record the course and every graded deliverable extracted from the syllabus.";
