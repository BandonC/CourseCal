// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { cleanPastedText } from "./paste";

// cleanPastedText uses DOMParser, so this file runs in a DOM env (happy-dom).
describe("cleanPastedText", () => {
  it("returns plain text unchanged (no HTML markup)", () => {
    const plain = "Assignment 1 due Oct 10, worth 20%\nMidterm Nov 5";
    expect(cleanPastedText(plain)).toBe(plain);
  });

  it("strips tags and decodes entities when the paste looks like HTML", () => {
    const html = "<p>Assignment 1 &amp; 2 <b>due</b> Oct 10</p>";
    expect(cleanPastedText(html)).toBe("Assignment 1 & 2 due Oct 10");
  });

  it("flattens a marked-up list into readable text", () => {
    const html = "<ul><li>Quiz 1</li><li>Quiz 2</li></ul>";
    const out = cleanPastedText(html);
    expect(out).toContain("Quiz 1");
    expect(out).toContain("Quiz 2");
    expect(out).not.toContain("<li>");
  });

  it("leaves a bare ampersand in plain text alone (not treated as HTML)", () => {
    const plain = "Lab & lecture attendance";
    expect(cleanPastedText(plain)).toBe(plain);
  });
});
