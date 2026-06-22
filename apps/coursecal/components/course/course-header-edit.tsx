"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateCourseAction } from "@/app/(app)/course/[id]/actions";
import { CourseEditSchema, type CourseEdit } from "@/app/(app)/course/[id]/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const nullableStr = (v: unknown) => (v === "" || v == null ? null : (v as string));

// Inline edit of the course header (name/code/instructor). Display reads straight
// from props (no local mirror), so router.refresh() after a save shows the new
// values. A label change re-patches event titles server-side; the toast reflects
// the Calendar outcome.
export function CourseHeaderEdit({
  courseId,
  name,
  code,
  instructor,
}: {
  courseId: string;
  name: string;
  code: string | null;
  instructor: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const { register, handleSubmit, reset, formState } = useForm<CourseEdit>({
    resolver: zodResolver(CourseEditSchema),
    defaultValues: { courseId, name, code, instructor },
  });

  const onSubmit = async (values: CourseEdit) => {
    const res = await updateCourseAction(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const { calendar, reconnectNeeded } = res.data;
    if (reconnectNeeded) {
      toast.warning("Saved. Reconnect Google Calendar to update event titles.", {
        action: { label: "Reconnect", onClick: () => router.push("/reconnect") },
      });
    } else if (calendar === "failed") {
      toast.warning("Saved, but some calendar titles couldn't update.");
    } else if (calendar === "patched") {
      toast.success("Course updated; calendar titles updated.");
    } else {
      toast.success("Course updated.");
    }
    setEditing(false);
    router.refresh();
  };

  if (!editing) {
    return (
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {code ? `${code} · ${name}` : name}
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reset({ courseId, name, code, instructor });
              setEditing(true);
            }}
          >
            Edit
          </Button>
        </div>
        {instructor ? <p className="text-muted-foreground">{instructor}</p> : null}
      </header>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-3">
      <input type="hidden" {...register("courseId")} />
      <div className="space-y-1.5">
        <Label htmlFor="course-name">Course name</Label>
        <Input id="course-name" {...register("name")} />
        {formState.errors.name ? (
          <p className="text-xs text-destructive">{formState.errors.name.message}</p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="course-code">Code</Label>
          <Input id="course-code" {...register("code", { setValueAs: nullableStr })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="course-instructor">Instructor</Label>
          <Input
            id="course-instructor"
            {...register("instructor", { setValueAs: nullableStr })}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={formState.isSubmitting}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
