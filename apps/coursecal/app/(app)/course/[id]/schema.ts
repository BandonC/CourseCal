import { DeliverableTypeSchema } from "@coursecal/syllabus-parser";
import { z } from "zod";

// Shared contract for the inline deliverable edit — the same Zod schema validates
// the RHF form (client) and the server action input (apps/coursecal/CLAUDE.md:
// define it once). Confidence/ambiguity_reason are the model's own assessment and
// are not edited here (mirrors the review UI), so they are not in the schema.
// Lives in its own module (not actions.ts) because a "use server" file may only
// export async functions.
const IsoDate = z.iso.date();
const Time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "invalid time");

export const DeliverableEditSchema = z.object({
  deliverableId: z.uuid(),
  title: z.string().trim().min(1, "title is required").max(300),
  type: DeliverableTypeSchema,
  dueDate: IsoDate.nullable(),
  dueTime: Time.nullable(),
  weightPercent: z.number().min(0).max(100).nullable(),
  notes: z.string().trim().max(2000).nullable(),
});

export type DeliverableEdit = z.infer<typeof DeliverableEditSchema>;

// Course header edit (name/code/instructor). Changing the label (code, or name
// when there's no code) re-patches the "<label> · <title>" prefix on the course's
// synced events; the action owns that. Shared by the form and the action.
export const CourseEditSchema = z.object({
  courseId: z.uuid(),
  name: z.string().trim().min(1, "course name is required").max(200),
  code: z.string().trim().max(50).nullable(),
  instructor: z.string().trim().max(200).nullable(),
});

export type CourseEdit = z.infer<typeof CourseEditSchema>;
