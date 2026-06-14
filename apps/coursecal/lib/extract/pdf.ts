"use client";

import { extractText, getDocumentProxy } from "unpdf";

// Client-side PDF text extraction (apps/coursecal/CLAUDE.md). PDFs are extracted
// in the browser via unpdf — only the resulting text is sent to the server, never
// the file (dodges Vercel's ~4.5MB body limit; the file never leaves the machine).
// unpdf bundles a serverless pdf.js build, so no worker setup is needed. The
// "use client" directive keeps unpdf/pdf.js out of the server bundle.

export type ExtractResult =
  | { ok: true; text: string; pageCount: number }
  | { ok: false; error: string };

/**
 * Extract plain text from a PDF File. Returns a user-safe error rather than
 * throwing or yielding an empty string — the parser must never receive empty
 * input (apps/coursecal/CLAUDE.md). Raw pdf.js errors are never surfaced (they
 * can leak internals); we map them to actionable hints.
 */
export async function extractPdfText(file: File): Promise<ExtractResult> {
  let data: Uint8Array;
  try {
    data = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "Couldn't read the file. Try re-uploading it." };
  }

  try {
    // getDocumentProxy applies safe defaults (isEvalSupported: false) and is where
    // encrypted-PDF errors surface; both are caught below.
    const pdf = await getDocumentProxy(data);
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const cleaned = normalizeText(text);
    if (cleaned.length === 0) {
      return {
        ok: false,
        error:
          "No text found in this PDF — it may be scanned or image-only. Paste the syllabus text instead.",
      };
    }
    return { ok: true, text: cleaned, pageCount: totalPages };
  } catch {
    return {
      ok: false,
      error:
        "Couldn't extract text from this PDF. If it's password-protected, remove the password and try again, or paste the text.",
    };
  }
}

// Conservative cleanup of common PDF extraction artifacts: normalize newlines,
// strip trailing spaces, collapse blank-line runs. Deliberately light — the
// parser wants faithful plain text, not aggressively reflowed text.
function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
