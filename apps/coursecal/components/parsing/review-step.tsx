"use client";

import { FormProvider, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ParseResultSchema, type ParseResult } from "@coursecal/syllabus-parser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeliverableRow } from "./deliverable-row";
import { NullableField } from "./nullable-field";

export function ReviewStep({
  result,
  onConfirm,
  onRestart,
  confirmLabel = "Looks good → export",
  cancelLabel = "Start over",
  showCourse = true,
}: {
  result: ParseResult;
  onConfirm: (result: ParseResult) => void;
  onRestart: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  // Re-parse replacement swaps deliverables only — hide the course fields there so
  // they aren't edited-then-discarded (course identity is edited on the header).
  showCourse?: boolean;
}) {
  // The library's own output schema validates the edited form — no parallel type
  // (apps/coursecal/CLAUDE.md). defaultValues are an already-valid ParseResult.
  const form = useForm<ParseResult>({
    resolver: zodResolver(ParseResultSchema),
    defaultValues: result,
  });
  const { register, control, handleSubmit, formState } = form;
  const { fields } = useFieldArray({ control, name: "deliverables" });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onConfirm)} className="space-y-6">
        {showCourse ? (
          <section className="space-y-4 rounded-lg border border-border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="course-name">Course</Label>
              <Input id="course-name" {...register("course.name")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <NullableField name="course.code" id="course-code" label="Code" />
              <NullableField name="course.instructor" id="course-instructor" label="Instructor" />
            </div>
            <p className="text-xs text-muted-foreground">
              Semester {result.course.semester_start} → {result.course.semester_end}
            </p>
          </section>
        ) : null}

        <h2 className="text-lg font-medium">
          Deliverables <span className="text-muted-foreground">({fields.length})</span>
        </h2>

        {fields.length === 0 ? (
          <p className="text-muted-foreground">
            No deliverables found. Start over and check the syllabus text.
          </p>
        ) : (
          <ul className="space-y-4">
            {fields.map((field, index) => (
              <DeliverableRow key={field.id} index={index} />
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={formState.isSubmitting}>
            {confirmLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onRestart}>
            {cancelLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
