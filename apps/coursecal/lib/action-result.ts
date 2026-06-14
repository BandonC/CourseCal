// Discriminated result for server actions (apps/coursecal/CLAUDE.md). On failure
// the client gets a user-safe `error` string plus an optional machine-readable
// `code` — never a raw Error.message, stack trace, or model/syllabus content
// (root CLAUDE.md security rules). Types only, safe to import from anywhere.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string };

export const actionOk = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const actionErr = (error: string, code?: string): ActionResult<never> => ({
  ok: false,
  error,
  code,
});
