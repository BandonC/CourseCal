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

// Input contract for the save action. The server re-validates the (client-edited)
// ParseResult against the library schema — the client is never trusted — plus the
// semester fields. `color` is assigned server-side, not accepted from the client.
export const SaveInputSchema = z
  .object({
    semesterName: z.string().trim().min(1, "semester name is required").max(120),
    semesterStart: IsoDate,
    semesterEnd: IsoDate,
    syllabusText: z.string().trim().min(1).max(MAX_SYLLABUS_CHARS),
    result: ParseResultSchema,
  })
  .refine((v) => v.semesterEnd >= v.semesterStart, {
    message: "semester end is before start",
    path: ["semesterEnd"],
  });

export type SaveInput = z.infer<typeof SaveInputSchema>;
