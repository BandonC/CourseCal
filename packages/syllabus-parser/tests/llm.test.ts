import { describe, it, expect } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import {
  ExtractionSchema,
  extractTool,
  extractionJsonSchema,
  AnthropicLLMClient,
  type LlmRequest,
} from "../src/llm";
import {
  DEFAULT_MODEL,
  EXTRACT_TOOL_NAME,
  resolveModel,
} from "../src/constants";

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
      title: "Midterm",
      type: "exam",
      due_date: "2026-10-20",
      due_date_expression: null,
      due_time: "18:30",
      weight_percent: 25,
      notes: null,
      recurrence: null,
      confidence: "high",
      ambiguity_reason: null,
    },
    {
      title: "Weekly quiz",
      type: "quiz",
      due_date: null,
      due_date_expression: null,
      due_time: "23:59",
      weight_percent: 20,
      notes: null,
      recurrence: {
        unit: "week",
        interval: 1,
        days_of_week: ["monday"],
        start_date: null, // extraction allows an unknown anchor; parse handles it
        end_date: null,
        count: 10,
      },
      confidence: "medium",
      ambiguity_reason: "cadence stated, anchor week not given",
    },
  ],
};

describe("ExtractionSchema", () => {
  it("accepts a representative extraction (expression + relaxed recurrence)", () => {
    expect(ExtractionSchema.safeParse(validExtraction).success).toBe(true);
  });

  it("rejects a deliverable missing confidence", () => {
    const bad = structuredClone(validExtraction);
    // @ts-expect-error — deliberately dropping a required field
    delete bad.deliverables[0].confidence;
    expect(ExtractionSchema.safeParse(bad).success).toBe(false);
  });
});

describe("tool definition", () => {
  it("extractionJsonSchema is a clean object schema with no $schema key", () => {
    const js = extractionJsonSchema();
    expect(js.type).toBe("object");
    expect(js).not.toHaveProperty("$schema");
    expect(js.required).toEqual(
      expect.arrayContaining(["course", "deliverables"]),
    );
  });

  it("extractTool names the forced tool and carries the schema", () => {
    const tool = extractTool();
    expect(tool.name).toBe(EXTRACT_TOOL_NAME);
    expect(tool.inputSchema.type).toBe("object");
  });
});

describe("resolveModel", () => {
  it("defaults to the documented Sonnet model", () => {
    expect(resolveModel({})).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("claude-sonnet-4-6");
  });

  it("prefers ANTHROPIC_MODEL when set, ignoring whitespace-only", () => {
    expect(resolveModel({ ANTHROPIC_MODEL: "claude-opus-4-8" })).toBe(
      "claude-opus-4-8",
    );
    expect(resolveModel({ ANTHROPIC_MODEL: "  " })).toBe(DEFAULT_MODEL);
  });
});

describe("AnthropicLLMClient — response mapping (no network)", () => {
  const req: LlmRequest = {
    model: DEFAULT_MODEL,
    maxTokens: 16_000,
    system: "sys",
    user: "user",
    tool: extractTool(),
  };

  it("returns the tool_use input on success", async () => {
    const fake = {
      messages: {
        create: async () => ({
          content: [
            { type: "text", text: "ignored" },
            {
              type: "tool_use",
              id: "tu_1",
              name: EXTRACT_TOOL_NAME,
              input: validExtraction,
            },
          ],
        }),
      },
    } as unknown as Anthropic;

    const r = await new AnthropicLLMClient(fake).extract(req);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual(validExtraction);
  });

  it("errors when the model returns no tool call", async () => {
    const fake = {
      messages: {
        create: async () => ({ content: [{ type: "text", text: "no tool" }] }),
      },
    } as unknown as Anthropic;

    const r = await new AnthropicLLMClient(fake).extract(req);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("did not return a tool call");
  });
});
