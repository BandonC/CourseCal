// The LLM-facing extraction schema — what the model fills via the `extract_syllabus`
// tool. Deliberately permissive vs. the public schema: it adds `due_date_expression`
// and relaxes recurrence anchors to nullable. The resolution pass in parse.ts
// converts/validates this into the public ParseResult (see schema.ts, PROMPT_DESIGN.md).
//
// Kept refinement-free so z.toJSONSchema converts cleanly for the tool input_schema;
// public invariants are enforced when mapping to ParseResultSchema.

import { z } from "zod";
import {
  ConfidenceSchema,
  CourseSchema,
  DayOfWeekSchema,
  DeliverableTypeSchema,
  IsoDateSchema,
  IsoTimeSchema,
  RecurrenceUnitSchema,
} from "../schema";
import { EXTRACT_TOOL_DESCRIPTION, EXTRACT_TOOL_NAME } from "../constants";

export const ExtractedRecurrenceSchema = z.object({
  unit: RecurrenceUnitSchema,
  interval: z.number().int().min(1),
  days_of_week: z.array(DayOfWeekSchema).nullable(),
  start_date: IsoDateSchema.nullable(),
  end_date: IsoDateSchema.nullable(),
  count: z.number().int().min(1).nullable(),
});

export const ExtractedDeliverableSchema = z.object({
  title: z.string().min(1),
  type: DeliverableTypeSchema,
  /** Absolute date stated in the syllabus, ISO. Null when relative or dateless. */
  due_date: IsoDateSchema.nullable(),
  /** Verbatim relative phrase ("Week 6") the resolver will map. Null otherwise. */
  due_date_expression: z.string().nullable(),
  due_time: IsoTimeSchema.nullable(),
  weight_percent: z.number().min(0).max(100).nullable(),
  notes: z.string().nullable(),
  recurrence: ExtractedRecurrenceSchema.nullable(),
  confidence: ConfidenceSchema,
  ambiguity_reason: z.string().nullable(),
});

export const ExtractionSchema = z.object({
  course: CourseSchema,
  deliverables: z.array(ExtractedDeliverableSchema),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedDeliverable = z.infer<typeof ExtractedDeliverableSchema>;
export type ExtractedRecurrence = z.infer<typeof ExtractedRecurrenceSchema>;

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

/** JSON Schema for the Anthropic tool input (strips the `$schema` key for cleanliness). */
export function extractionJsonSchema(): Record<string, unknown> {
  const js = z.toJSONSchema(ExtractionSchema) as Record<string, unknown>;
  delete js.$schema;
  return js;
}

export function extractTool(): ToolDefinition {
  return {
    name: EXTRACT_TOOL_NAME,
    description: EXTRACT_TOOL_DESCRIPTION,
    inputSchema: extractionJsonSchema(),
  };
}
