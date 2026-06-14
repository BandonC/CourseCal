import { describe, expect, it } from "vitest";
import { ParseInputSchema } from "./schema";

const validContext = {
  semesterStart: "2026-09-01",
  semesterEnd: "2026-12-15",
  today: "2026-08-20",
  timezone: "America/Toronto",
};

describe("ParseInputSchema", () => {
  it("accepts well-formed input", () => {
    const parsed = ParseInputSchema.safeParse({
      text: "CS101 syllabus…",
      context: validContext,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects empty / whitespace-only text", () => {
    expect(ParseInputSchema.safeParse({ text: "   ", context: validContext }).success).toBe(
      false,
    );
  });

  it("rejects text over the 200k character cap", () => {
    const parsed = ParseInputSchema.safeParse({
      text: "x".repeat(200_001),
      context: validContext,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed ISO date in context", () => {
    const parsed = ParseInputSchema.safeParse({
      text: "ok",
      context: { ...validContext, semesterStart: "09/01/2026" },
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects missing context", () => {
    expect(ParseInputSchema.safeParse({ text: "ok" }).success).toBe(false);
  });

  it("accepts optional readingWeeks and holidays", () => {
    const parsed = ParseInputSchema.safeParse({
      text: "ok",
      context: {
        ...validContext,
        readingWeeks: [{ start: "2026-10-12", end: "2026-10-16" }],
        holidays: ["2026-09-07"],
      },
    });
    expect(parsed.success).toBe(true);
  });
});
