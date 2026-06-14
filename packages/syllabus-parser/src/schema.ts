// Canonical output schema for the syllabus parser. Zod is the single source of
// truth; every exported type is `z.infer` of its schema (see CLAUDE.md).
// This is the PUBLIC, post-resolution shape (COURSECAL.md §8.2). The LLM-facing
// extraction schema (which adds a relative-date expression field) is defined in
// src/llm/ next to the Anthropic tool, reusing these building blocks.
//
// Dates are ISO strings, not Date objects: it's what the Claude tool emits, what
// the DB `date`/`time` columns want, and it sidesteps Date timezone footguns.

import { z } from "zod";

/** ISO calendar date, e.g. "2026-09-01". Rejects impossible dates (2026-13-45). */
export const IsoDateSchema = z.iso.date();
/** 24h wall-clock time, e.g. "23:59". */
export const IsoTimeSchema = z.iso.time();

export const DeliverableTypeSchema = z.enum([
  "assignment",
  "exam",
  "quiz",
  "project",
  "reading",
  "presentation",
  "participation",
  "other",
]);
export type DeliverableType = z.infer<typeof DeliverableTypeSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const RecurrenceUnitSchema = z.enum(["week", "month"]);
export type RecurrenceUnit = z.infer<typeof RecurrenceUnitSchema>;

export const DayOfWeekSchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]);
export type DayOfWeek = z.infer<typeof DayOfWeekSchema>;

/**
 * A rule-stated recurring cadence (e.g. "weekly quiz", "every other Friday").
 * Enumerated dates ("quizzes on Sep 8, 22, ...") are emitted as separate one-off
 * deliverables, not a recurrence. The app expands a descriptor into N rows at
 * save time (COURSECAL.md §7.1).
 */
export const RecurrenceSchema = z
  .object({
    unit: RecurrenceUnitSchema,
    /** Cadence multiplier: weekly = {week, 1}, biweekly = {week, 2}. */
    interval: z.number().int().min(1),
    /**
     * Weekdays the item recurs on within an interval-th week. `null` = no
     * weekday pinned (lowers confidence). Non-empty when present. Ignored when
     * `unit` is "month" — monthly items anchor on `start_date`'s day-of-month.
     */
    days_of_week: z.array(DayOfWeekSchema).min(1).nullable(),
    start_date: IsoDateSchema,
    /** Terminator by date. At least one of end_date / count must be present. */
    end_date: IsoDateSchema.nullable(),
    /** Terminator by occurrence count, when the syllabus states "N quizzes". */
    count: z.number().int().min(1).nullable(),
  })
  .refine((r) => r.end_date !== null || r.count !== null, {
    message: "recurrence requires end_date or count to bound the series",
    path: ["end_date"],
  });
export type Recurrence = z.infer<typeof RecurrenceSchema>;

export const DeliverableSchema = z
  .object({
    title: z.string().min(1),
    type: DeliverableTypeSchema,
    /**
     * `null` for dateless items (e.g. participation) and for recurring items
     * (the recurrence descriptor carries the dates).
     */
    due_date: IsoDateSchema.nullable(),
    due_time: IsoTimeSchema.nullable(),
    /**
     * Grade weight as a percentage. For recurring items this is the SERIES
     * total; the app splits it across occurrences at expansion (§7.1).
     */
    weight_percent: z.number().min(0).max(100).nullable(),
    notes: z.string().nullable(),
    recurrence: RecurrenceSchema.nullable(),
    confidence: ConfidenceSchema,
    /** Required whenever confidence is not "high" (§8.3). */
    ambiguity_reason: z.string().nullable(),
  })
  .superRefine((d, ctx) => {
    if (
      d.confidence !== "high" &&
      (d.ambiguity_reason === null || d.ambiguity_reason.trim() === "")
    ) {
      ctx.addIssue({
        code: "custom",
        message: "ambiguity_reason is required when confidence is not high",
        path: ["ambiguity_reason"],
      });
    }
    if (d.recurrence !== null && d.due_date !== null) {
      ctx.addIssue({
        code: "custom",
        message:
          "a recurring deliverable must not also carry a single due_date; the recurrence carries the dates",
        path: ["due_date"],
      });
    }
  });
export type Deliverable = z.infer<typeof DeliverableSchema>;

export const CourseSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullable(),
  instructor: z.string().nullable(),
  semester_start: IsoDateSchema,
  semester_end: IsoDateSchema,
});
export type Course = z.infer<typeof CourseSchema>;

export const ParseResultSchema = z.object({
  course: CourseSchema,
  deliverables: z.array(DeliverableSchema),
});
export type ParseResult = z.infer<typeof ParseResultSchema>;
