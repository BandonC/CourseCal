import { normalizeText } from "./shared";

// Paste cleanup (§2.3). A plain <textarea> already yields plain text in the normal
// case — the browser strips markup on paste — but some sources drop literal HTML
// into text/plain (e.g. copying rendered LMS pages). When the pasted text looks
// like markup, strip tags and decode entities via the browser DOM; otherwise leave
// it untouched. Uses DOMParser, so it runs client-side (called from SourcePicker).
const HTML_HINT = /<\/?[a-z][^>]*>|&(?:[a-z]+|#\d+);/i;

export function cleanPastedText(raw: string): string {
  if (!HTML_HINT.test(raw)) return raw;
  const doc = new DOMParser().parseFromString(raw, "text/html");
  return normalizeText(doc.body.textContent ?? "");
}
