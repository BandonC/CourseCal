import type { Deliverable, ParseResult } from "@coursecal/syllabus-parser";
import type { SeriesId } from "@/lib/db/ids";
import type { deliverables } from "@/lib/db/schema";
import { expandRecurrence } from "./expand";

// Maps the library's ParseResult deliverables into DB row values (§7.1): one-offs
// become a single row; recurring items expand into one row per occurrence sharing
// a generated series_id, with the series weight split evenly across instances.
// Pure given `newId` — the caller injects randomUUID in app code, a deterministic
// counter in tests. The caller stamps `courseId` and `id` at insert time.

type DeliverableRowValues = Omit<typeof deliverables.$inferInsert, "courseId" | "id">;

function weightString(weight: number | null): string | null {
  // numeric(5,2): round to 2dp. Splitting unevenly (10%/3) drifts by cents — an
  // accepted tradeoff so week-level workload sums stay close (§7.1).
  return weight === null ? null : weight.toFixed(2);
}

function buildRow(
  d: Deliverable,
  over: { dueDate: string | null; weight: number | null; seriesId: SeriesId | null },
): DeliverableRowValues {
  return {
    title: d.title,
    type: d.type,
    dueDate: over.dueDate,
    dueTime: d.due_time,
    weightPercent: weightString(over.weight),
    notes: d.notes,
    confidence: d.confidence,
    ambiguityReason: d.ambiguity_reason,
    seriesId: over.seriesId,
    googleEventId: null,
  };
}

export function toDeliverableRows(
  items: ParseResult["deliverables"],
  newId: () => string,
): DeliverableRowValues[] {
  const rows: DeliverableRowValues[] = [];

  for (const d of items) {
    if (d.recurrence) {
      const dates = expandRecurrence(d.recurrence);
      if (dates.length === 0) continue; // malformed series — nothing to store
      const seriesId = newId() as SeriesId;
      const perInstance =
        d.weight_percent === null ? null : d.weight_percent / dates.length;
      for (const dueDate of dates) {
        rows.push(buildRow(d, { dueDate, weight: perInstance, seriesId }));
      }
    } else {
      rows.push(
        buildRow(d, { dueDate: d.due_date, weight: d.weight_percent, seriesId: null }),
      );
    }
  }

  return rows;
}
