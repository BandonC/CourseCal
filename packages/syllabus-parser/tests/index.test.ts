import { describe, it, expect } from "vitest";
import {
  parseSyllabus,
  ParseResultSchema,
  DeliverableTypeSchema,
  AnthropicLLMClient,
} from "../src";

describe("public API surface", () => {
  it("exports the entry point and canonical schemas", () => {
    expect(typeof parseSyllabus).toBe("function");
    expect(typeof ParseResultSchema.safeParse).toBe("function");
    expect(DeliverableTypeSchema.options).toContain("assignment");
    expect(typeof AnthropicLLMClient).toBe("function");
  });

  it("dryRun works through the package entry point", async () => {
    const r = await parseSyllabus(
      "A syllabus.",
      {
        semesterStart: "2026-09-07",
        semesterEnd: "2026-12-07",
        today: "2026-09-01",
        timezone: "America/Toronto",
      },
      { dryRun: true },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.version).toBe("v2");
  });
});
