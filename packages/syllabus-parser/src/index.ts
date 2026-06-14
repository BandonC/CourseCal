// Public API for @coursecal/syllabus-parser. See COURSECAL.md §8.
//
// The library is a pure function: parseSyllabus(text, context, options?) → Result.
// It owns the canonical output schema/types and the LLM client seam. Everything
// else (PDF extraction, persistence, Calendar, conflict detection) is the app's job.

export { parseSyllabus } from "./parse";
export type { SyllabusContext, ParseOptions, DryRunResult } from "./parse";

export type { Result, ParseError } from "./result";

// Canonical schemas + inferred types (§5.2 — the library defines and exports these).
export {
  ParseResultSchema,
  CourseSchema,
  DeliverableSchema,
  RecurrenceSchema,
  DeliverableTypeSchema,
  ConfidenceSchema,
  RecurrenceUnitSchema,
  DayOfWeekSchema,
} from "./schema";
export type {
  ParseResult,
  Course,
  Deliverable,
  Recurrence,
  DeliverableType,
  Confidence,
  RecurrenceUnit,
  DayOfWeek,
} from "./schema";

// The LLM seam: default Anthropic client, plus the interface for stubs / eval replay.
export { AnthropicLLMClient } from "./llm";
export type { LLMClient, LlmRequest, LlmError } from "./llm";
