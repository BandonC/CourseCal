import { ParseResultSchema } from "@coursecal/syllabus-parser";
import { z } from "zod";

// Server-side input contract for the parse action. The library re-checks length
// and shape internally, but the action owns validating untrusted client input
// (apps/coursecal/CLAUDE.md — every server action validates with Zod). The 200k
// char cap mirrors the library's MAX_SYLLABUS_CHARS and the root CLAUDE.md
// parse-input rule; it's the one real server-side control in Phase 2.

const MAX_SYLLABUS_CHARS = 200_000;

const IsoDate = z.iso.date();

export const ParseInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "syllabus text is empty")
    .max(MAX_SYLLABUS_CHARS, "syllabus exceeds the size limit"),
  context: z.object({
    semesterStart: IsoDate,
    semesterEnd: IsoDate,
    today: IsoDate,
    timezone: z.string().min(1),
    readingWeeks: z.array(z.object({ start: IsoDate, end: IsoDate })).optional(),
    holidays: z.array(IsoDate).optional(),
  }),
  // Debug affordance: return the assembled prompt without an LLM call. The prompt
  // is non-secret (it lives in the repo); useful for verifying wiring pre-spend.
  dryRun: z.boolean().optional(),
});

export type ParseInput = z.infer<typeof ParseInputSchema>;

// One parsed-and-reviewed course in a save. The server re-validates each
// (client-edited) ParseResult against the library schema — the client is never
// trusted. `color` is assigned server-side by course index, not accepted here.
const CourseSaveSchema = z.object({
  syllabusText: z.string().trim().min(1).max(MAX_SYLLABUS_CHARS),
  result: ParseResultSchema,
});

// Input contract for the save action: one semester holding one or more reviewed
// courses (the Phase-4 multi-syllabus flow). The cap guards against abuse — a real
// semester is ~4–6 courses.
export const SaveSemesterInputSchema = z
  .object({
    semesterName: z.string().trim().min(1, "semester name is required").max(120),
    semesterStart: IsoDate,
    semesterEnd: IsoDate,
    courses: z
      .array(CourseSaveSchema)
      .min(1, "at least one course is required")
      .max(12),
  })
  .refine((v) => v.semesterEnd >= v.semesterStart, {
    message: "semester end is before start",
    path: ["semesterEnd"],
  });

export type SaveSemesterInput = z.infer<typeof SaveSemesterInputSchema>;

// Input contract for adding course(s) to an existing semester (§3.3). Same course
// shape as a save, but keyed on the existing semesterId instead of name/dates —
// the dates already live on the semester row and drive the parse context.
export const AddCoursesInputSchema = z.object({
  semesterId: z.uuid(),
  courses: z.array(CourseSaveSchema).min(1, "at least one course is required").max(12),
});

export type AddCoursesInput = z.infer<typeof AddCoursesInputSchema>;
