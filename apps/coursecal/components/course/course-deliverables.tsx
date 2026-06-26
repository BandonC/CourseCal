"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeliverableTypeSchema, type Confidence } from "@coursecal/syllabus-parser";
import { toast } from "sonner";
import {
  updateDeliverableAction,
  type EditCalendarOutcome,
} from "@/app/(app)/course/[id]/actions";
import {
  DeliverableEditSchema,
  type DeliverableEdit,
} from "@/app/(app)/course/[id]/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DeleteDeliverableDialog } from "@/components/course/delete-deliverable-dialog";
import type { DeliverableField } from "@/lib/analytics/events";
import { useAnalytics } from "@/lib/analytics/use-analytics";
import type { CourseDeliverable } from "@/lib/db/queries/courses";

// Maps the edit form's field keys to the analytics field vocabulary.
const FIELD_MAP: Record<string, DeliverableField> = {
  title: "title",
  type: "type",
  dueDate: "due_date",
  dueTime: "due_time",
  weightPercent: "weight",
  notes: "notes",
};

const CONFIDENCE_VARIANT: Record<Confidence, "outline" | "secondary" | "destructive"> = {
  high: "outline",
  medium: "secondary",
  low: "destructive",
};

// "" → null for the optional fields (the DB columns and edit schema are nullable).
const nullableStr = (v: unknown) => (v === "" || v == null ? null : (v as string));

function whenLabel(d: Pick<CourseDeliverable, "dueDate" | "dueTime">): string {
  if (!d.dueDate) return "No date";
  return d.dueTime ? `${d.dueDate} · ${d.dueTime.slice(0, 5)}` : d.dueDate;
}

export function CourseDeliverables({
  courseId,
  deliverables,
}: {
  courseId: string;
  deliverables: CourseDeliverable[];
}) {
  const [rows, setRows] = useState(deliverables);

  if (rows.length === 0) {
    return <p className="text-muted-foreground">No deliverables for this course.</p>;
  }

  const onSaved = (updated: CourseDeliverable) =>
    setRows((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
  const onRemove = (ids: string[]) =>
    setRows((rs) => rs.filter((r) => !ids.includes(r.id)));

  // Ids grouped by series, so a recurring row knows its siblings (for "delete
  // all N") without another query.
  const idsBySeries = new Map<string, string[]>();
  for (const r of rows) {
    if (r.seriesId) {
      const list = idsBySeries.get(r.seriesId) ?? [];
      list.push(r.id);
      idsBySeries.set(r.seriesId, list);
    }
  }

  return (
    <ul className="space-y-3">
      {rows.map((d) => (
        <DeliverableRow
          key={d.id}
          d={d}
          courseId={courseId}
          siblingIds={d.seriesId ? (idsBySeries.get(d.seriesId) ?? [d.id]) : [d.id]}
          onSaved={onSaved}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}

function DeliverableRow({
  d,
  courseId,
  siblingIds,
  onSaved,
  onRemove,
}: {
  d: CourseDeliverable;
  courseId: string;
  siblingIds: string[];
  onSaved: (d: CourseDeliverable) => void;
  onRemove: (ids: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="space-y-2 rounded-lg border border-border p-4">
      {editing ? (
        <EditForm
          d={d}
          onCancel={() => setEditing(false)}
          onSaved={(u) => {
            onSaved(u);
            setEditing(false);
          }}
        />
      ) : (
        <Display
          d={d}
          courseId={courseId}
          siblingIds={siblingIds}
          onEdit={() => setEditing(true)}
          onRemove={onRemove}
        />
      )}
    </li>
  );
}

function Display({
  d,
  courseId,
  siblingIds,
  onEdit,
  onRemove,
}: {
  d: CourseDeliverable;
  courseId: string;
  siblingIds: string[];
  onEdit: () => void;
  onRemove: (ids: string[]) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{d.title}</span>
        <div className="flex items-center gap-2">
          <Badge variant={CONFIDENCE_VARIANT[d.confidence]} className="capitalize">
            {d.confidence}
          </Badge>
          <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
            Edit
          </Button>
          <DeleteDeliverableDialog
            deliverableId={d.id}
            title={d.title}
            courseId={courseId}
            seriesId={d.seriesId}
            seriesCount={siblingIds.length}
            siblingIds={siblingIds}
            onRemove={onRemove}
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span className="capitalize">{d.type}</span>
        <span>{whenLabel(d)}</span>
        {d.weightPercent != null ? <span>{Number(d.weightPercent)}%</span> : null}
        {d.seriesId ? <Badge variant="outline">recurring</Badge> : null}
      </div>
      {d.confidence !== "high" && d.ambiguityReason ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Why flagged:</span> {d.ambiguityReason}
        </p>
      ) : null}
    </>
  );
}

function notify(outcome: EditCalendarOutcome, onReconnect: () => void) {
  switch (outcome) {
    case "patched":
    case "created":
    case "recreated":
    case "deleted":
      toast.success("Calendar updated");
      break;
    case "none":
      toast.success("Saved");
      break;
    case "failed":
      toast.warning("Saved, but the calendar event couldn't be updated.");
      break;
    case "skipped":
      toast.warning("Saved. Reconnect Google Calendar to sync this change.", {
        action: { label: "Reconnect", onClick: onReconnect },
      });
      break;
  }
}

function EditForm({
  d,
  onCancel,
  onSaved,
}: {
  d: CourseDeliverable;
  onCancel: () => void;
  onSaved: (d: CourseDeliverable) => void;
}) {
  const router = useRouter();
  const { capture } = useAnalytics();
  const { register, control, handleSubmit, formState } = useForm<DeliverableEdit>({
    resolver: zodResolver(DeliverableEditSchema),
    defaultValues: {
      deliverableId: d.id,
      title: d.title,
      type: d.type,
      dueDate: d.dueDate,
      dueTime: d.dueTime ? d.dueTime.slice(0, 5) : null,
      weightPercent: d.weightPercent != null ? Number(d.weightPercent) : null,
      notes: d.notes,
    },
  });

  const onSubmit = async (values: DeliverableEdit) => {
    const res = await updateDeliverableAction(values);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const changed = new Set<DeliverableField>();
    for (const key of Object.keys(formState.dirtyFields)) {
      const field = FIELD_MAP[key];
      if (field) changed.add(field);
    }
    for (const field of changed) {
      capture({ name: "deliverable_edited", properties: { field, context: "course_detail" } });
    }
    capture({
      name: "deliverable_calendar_synced",
      properties: { outcome: res.data.calendar },
    });
    onSaved({
      ...d,
      title: values.title,
      type: values.type,
      dueDate: values.dueDate,
      dueTime: values.dueTime,
      weightPercent: values.weightPercent != null ? values.weightPercent.toFixed(2) : null,
      notes: values.notes,
      // Editing verifies the row server-side (confidence → high, flag cleared);
      // mirror it so the badge and "why flagged" update without a refetch.
      confidence: "high",
      ambiguityReason: null,
    });
    notify(res.data.calendar, () => router.push("/reconnect"));
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <input type="hidden" {...register("deliverableId")} />
      <div className="space-y-1.5">
        <Label htmlFor={`title-${d.id}`}>Title</Label>
        <Input id={`title-${d.id}`} {...register("title")} />
        {formState.errors.title ? (
          <p className="text-xs text-destructive">{formState.errors.title.message}</p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Type</Label>
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DeliverableTypeSchema.options.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`weight-${d.id}`}>Weight %</Label>
          <Input
            id={`weight-${d.id}`}
            type="number"
            step="0.01"
            {...register("weightPercent", {
              setValueAs: (v) => (v === "" || v == null ? null : Number(v)),
            })}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`date-${d.id}`}>Due date</Label>
          <Input id={`date-${d.id}`} type="date" {...register("dueDate", { setValueAs: nullableStr })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`time-${d.id}`}>Due time</Label>
          <Input id={`time-${d.id}`} type="time" {...register("dueTime", { setValueAs: nullableStr })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`notes-${d.id}`}>Notes</Label>
        <Textarea
          id={`notes-${d.id}`}
          className="min-h-16"
          {...register("notes", { setValueAs: nullableStr })}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={formState.isSubmitting}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
