"use client";

import { type ExtractResult, normalizeText } from "./shared";

// Client-side DOCX text extraction, mirroring pdf.ts: mammoth reads the .docx in
// the browser and only the extracted text is sent to the server, never the file.
// mammoth is dynamically imported so its bundle loads only when a DOCX is actually
// processed — not on every visit to the upload page. Raw mammoth errors are never
// surfaced (they can leak internals); we map them to actionable hints.
export async function extractDocxText(file: File): Promise<ExtractResult> {
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch {
    return { ok: false, error: "Couldn't read the file. Try re-uploading it." };
  }

  try {
    const mammoth = (await import("mammoth")).default;
    // Raw text (not HTML) — the parser wants plain text, and .value carries it.
    const { value } = await mammoth.extractRawText({ arrayBuffer });
    const cleaned = normalizeText(value);
    if (cleaned.length === 0) {
      return {
        ok: false,
        error: "No text found in this document. Paste the syllabus text instead.",
      };
    }
    return { ok: true, text: cleaned };
  } catch {
    return {
      ok: false,
      error:
        "Couldn't read this Word file. Make sure it's a .docx (not the older .doc), or paste the text.",
    };
  }
}
