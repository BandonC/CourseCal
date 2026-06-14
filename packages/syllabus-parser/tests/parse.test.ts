import { describe, it, expect } from "vitest";
import { parseSyllabus } from "../src/parse";
import { ok, err } from "../src/result";
import { MAX_SYLLABUS_CHARS } from "../src/constants";
import type { LLMClient } from "../src/llm";

const context = {
  semesterStart: "2026-09-07",
  semesterEnd: "2026-12-07",
  today: "2026-09-01",
  timezone: "America/Toronto",
};

const validExtraction = {
  course: {
    name: "Databases",
    code: "CS 348",
    instructor: null,
    semester_start: "2026-09-07",
    semester_end: "2026-12-07",
  },
  deliverables: [
    {
      title: "Quiz 1",
      type: "quiz",
      due_date: null,
      due_date_expression: "Week 3",
      due_time: null,
      weight_percent: 5,
      notes: null,
      recurrence: null,
      confidence: "high",
      ambiguity_reason: null,
    },
  ],
};

const stubReturning = (data: unknown): LLMClient => ({
  extract: async () => ok(data),
});
const throwingStub: LLMClient = {
  extract: async () => {
    throw new Error("LLM should not be called");
  },
};

describe("parseSyllabus — input guards", () => {
  it("rejects empty / whitespace-only text", async () => {
    const r = await parseSyllabus("   \n ", context, {
      llmClient: throwingStub,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("empty_input");
  });

  it("rejects text over the character cap", async () => {
    const r = await parseSyllabus("a".repeat(MAX_SYLLABUS_CHARS + 1), context, {
      llmClient: throwingStub,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("input_too_large");
  });
});

describe("parseSyllabus — dryRun", () => {
  it("returns the assembled prompt without calling the model", async () => {
    const r = await parseSyllabus("Real syllabus body.", context, {
      dryRun: true,
      llmClient: throwingStub,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.version).toBe("v1");
      expect(r.data.system).toContain("extract_syllabus");
      expect(r.data.user).toContain(
        "<syllabus>\nReal syllabus body.\n</syllabus>",
      );
    }
  });
});

describe("parseSyllabus — full pipeline (stubbed LLM)", () => {
  it("validates, resolves dates, and returns a public ParseResult", async () => {
    const r = await parseSyllabus("Real syllabus body.", context, {
      llmClient: stubReturning(validExtraction),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.data.deliverables[0]!;
      expect(d.due_date).toBe("2026-09-21"); // "Week 3" resolved
      expect(d.confidence).toBe("medium"); // inferred date → capped
    }
  });

  it("surfaces an LLM failure as llm_error", async () => {
    const client: LLMClient = { extract: async () => err({ message: "boom" }) };
    const r = await parseSyllabus("Real syllabus body.", context, {
      llmClient: client,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("llm_error");
      expect(r.error.message).toBe("boom");
    }
  });

  it("rejects model output that doesn't match the schema", async () => {
    const r = await parseSyllabus("Real syllabus body.", context, {
      llmClient: stubReturning({ not: "an extraction" }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("invalid_response");
  });
});
