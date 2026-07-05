// Shared shape + text cleanup for the client-side extractors (PDF, DOCX) and the
// paste-cleanup path. Pure — no browser APIs — so it's safe to import anywhere.
// normalizeText is deliberately light: the parser wants faithful plain text, not
// aggressively reflowed text.

export type ExtractResult = { ok: true; text: string } | { ok: false; error: string };

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
