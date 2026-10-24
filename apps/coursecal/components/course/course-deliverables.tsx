"use client";

import { CheckIcon, ChevronRightIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeliverableTypeSchema, type Confidence } from "@coursecal/syllabus-parser";
import { toast } from "sonner";
import {
  resolveDeliverableFlagAction,
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
import { formatDay } from "@/lib/today";

// Maps the edit form's field keys to the analytics field vocabulary.
const FIELD_MAP: Record<string, DeliverableField> = {
  title: "title",
  type: "type",
  dueDate: "due_date",
  dueTime: "due_time",
  weightPercent: "weight",
  notes: "notes",
};

const CONFIDENCE_VARIANT: Record<Confidence, "success" | "warning" | "destructive"> = {
  high: "success",
  medium: "warning",
  low: "destructive",
};

// "" → null for the optional fields (the DB columns and edit schema are nullable).
const nullableStr = (v: unknown) => (v === "" || v == null ? null : (v as string));

function whenLabel(d: Pick<CourseDeliverable, "dueDate" | "dueTime">): string {
  if (!d.dueDate) return "No date";
  return d.dueTime ? `${formatDay(d.dueDate)} · ${d.dueTime.slice(0, 5)}` : formatDay(d.dueDate);
}

const isFlagged = (d: CourseDeliverable) => d.confidence !== "high";

// One-offs render as rows; a recurring series (2+ rows sharing a seriesId)
// collapses into one expandable group, placed where its first row falls in the
// date order.
type Item = { kind: "row"; d: CourseDeliverable } | { kind: "series"; members: CourseDeliverable[] };

function toItems(rows: CourseDeliverable[], idsBySeries: Map<string, string[]>): Item[] {
  const items: Item[] = [];
  const placed = new Set<string>();
  for (const d of rows) {
    if (d.seriesId && (idsBySeries.get(d.seriesId)?.length ?? 0) > 1) {
      if (placed.has(d.seriesId)) continue;
      placed.add(d.seriesId);
      items.push({ kind: "series", members: rows.filter((r) => r.seriesId === d.seriesId) });
    } else {
      items.push({ kind: "row", d });
    }
  }
  return items;
}

// Date order with dateless rows last — matches the server's ordering, and
// re-applies after an inline edit moves a row's date (or clears it). Array sort
// is stable, so ties keep their server order.
function byDue(a: CourseDeliverable, b: CourseDeliverable): number {
  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return (a.dueTime ?? "").localeCompare(b.dueTime ?? "");
}

const sumWeight = (rows: CourseDeliverable[]) =>
  rows.reduce((s, r) => s + (r.weightPercent != null ? Number(r.weightPercent) : 0), 0);

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

  const rowProps = (d: CourseDeliverable) => ({
    d,
    courseId,
    siblingIds: d.seriesId ? (idsBySeries.get(d.seriesId) ?? [d.id]) : [d.id],
    onSaved,
    onRemove,
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <ul className="divide-y divide-border">
        {toItems([...rows].sort(byDue), idsBySeries).map((item) =>
          item.kind === "row" ? (
            <DeliverableRow key={item.d.id} {...rowProps(item.d)} />
          ) : (
            <SeriesGroup key={item.members[0]!.seriesId} members={item.members}>
              {item.members.map((m) => (
                <DeliverableRow key={m.id} {...rowProps(m)} />
              ))}
            </SeriesGroup>
          ),
        )}
      </ul>
      <p className="border-t border-border bg-muted/30 px-4 py-2 text-right text-sm text-muted-foreground">
        Weights total{" "}
        <span className="font-medium text-foreground">{Number(sumWeight(rows).toFixed(2))}%</span>
      </p>
    </div>
  );
}

function SeriesGroup({
  members,
  children,
}: {
  members: CourseDeliverable[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const first = members[0]!;
  const dated = members.flatMap((m) => (m.dueDate ? [m.dueDate] : []));
  const weight = sumWeight(members);
  const flagged = members.filter(isFlagged).length;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
      >
        <ChevronRightIcon
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {first.title}{" "}
            <span className="font-normal text-muted-foreground">×{members.length}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{first.type}</span>
            {dated.length > 0
              ? ` · ${formatDay(dated[0]!)} – ${formatDay(dated[dated.length - 1]!)}`
              : ""}
            {weight > 0 ? ` · ${Number(weight.toFixed(2))}% total` : ""}
          </p>
        </div>
        {flagged > 0 ? <Badge variant="warning">{flagged} to check</Badge> : null}
      </button>
      {open ? (
        <ul className="divide-y divide-border border-t border-border bg-muted/20 pl-6">
          {children}
        </ul>
      ) : null}
    </li>
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
  const [resolving, setResolving] = useState(false);

  // "Looks good": confirm a flagged (medium/low) item without opening the form.
  // DB-only (confidence → high, flag cleared) — no Calendar round-trip, so it's
  // instant and can't fail on a sync; the event's cosmetic "Flagged" line stays
  // until a real edit.
  async function markResolved() {
    if (resolving) return;
    setResolving(true);
    try {
      const res = await resolveDeliverableFlagAction(d.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSaved({ ...d, confidence: "high", ambiguityReason: null });
    } finally {
      setResolving(false);
    }
  }

  return (
    <li className={editing ? "p-4" : "px-4 py-2.5"}>
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
          onResolve={markResolved}
          resolving={resolving}
          onRemove={onRemove}
        />
      )}
    </li>
  );
}

// One dense row: date | title + type/weight | confidence (flagged only) | icon
// actions. High confidence shows no badge, so only items needing a look stand out.
function Display({
  d,
  courseId,
  siblingIds,
  onEdit,
  onResolve,
  resolving,
  onRemove,
}: {
  d: CourseDeliverable;
  courseId: string;
  siblingIds: string[];
  onEdit: () => void;
  onResolve: () => void;
  resolving: boolean;
  onRemove: (ids: string[]) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span className="w-28 shrink-0 text-sm tabular-nums text-muted-foreground sm:w-36">
          {whenLabel(d)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{d.title}</p>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{d.type}</span>
            {d.weightPercent != null ? ` · ${Number(d.weightPercent)}%` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isFlagged(d) ? (
            <>
              <Badge variant={CONFIDENCE_VARIANT[d.confidence]} className="mr-1 capitalize">
                {d.confidence}
              </Badge>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={onResolve}
                disabled={resolving}
                title="Mark as checked"
                aria-label="Mark as checked"
              >
                <CheckIcon />
              </Button>
            </>
          ) : null}
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
            onClick={onEdit}
            title="Edit"
            aria-label={`Edit ${d.title}`}
          >
            <PencilIcon />
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
      {isFlagged(d) && d.ambiguityReason ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <span className="font-medium">Why flagged:</span> {d.ambiguityReason}
        </p>
      ) : null}
    </>
  );
}

function notify(outcome: EditCalendarOutcome, onReconnect: () => void) {
  switch (outcome) {
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
        <Button type="submit" loading={formState.isSubmitting}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={formState.isSubmitting}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
