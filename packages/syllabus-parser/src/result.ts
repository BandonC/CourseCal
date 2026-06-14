// Result type and the parser's typed error channel.
// See packages/syllabus-parser/CLAUDE.md — expected failures are Results, not throws.

export type Result<T, E = ParseError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Expected, typed failures from `parseSyllabus`. `message` is always safe to
 * surface to a caller — it never carries raw model output or syllabus content.
 */
export type ParseError =
  | { kind: "empty_input"; message: string }
  | { kind: "input_too_large"; message: string }
  | { kind: "llm_error"; message: string }
  | { kind: "invalid_response"; message: string };

export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
