// Pure mapping: model extraction → public ParseResult. Runs the date resolver on
// relative expressions, applies the confidence rules, and normalizes recurrence.
// No I/O, no LLM — see CLAUDE.md (purity) and PROMPT_DESIGN.md (the v1 rules).

import { resolveRelativeDate, type DateResolutionContext } from "./dates";
import { type Extraction, type ExtractedDeliverable } from "./llm/extraction";
import {
  type Confidence,
  type Deliverable,
  type ParseResult,
  type Recurrence,
} from "./schema";

const CONFIDENCE_RANK: Record<Confidence, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

/** The lower of two confidence levels (inferred data can only downgrade). */
function cap(c: Confidence, ceiling: Confidence): Confidence {
  return CONFIDENCE_RANK[c] <= CONFIDENCE_RANK[ceiling] ? c : ceiling;
}

/** Public schema requires a non-blank reason whenever confidence isn't "high". */
function ensureReason(
  confidence: Confidence,
  reason: string | null,
): string | null {
  if (confidence !== "high" && (reason === null || reason.trim() === "")) {
    return "flagged for review";
  }
  return reason;
}

function deliverable(
  d: ExtractedDeliverable,
  dueDate: string | null,
  recurrence: Recurrence | null,
  confidence: Confidence,
  reason: string | null,
): Deliverable {
  return {
    title: d.title,
    type: d.type,
    due_date: dueDate,
    due_time: d.due_time,
    weight_percent: d.weight_percent,
    notes: d.notes,
    recurrence,
    confidence,
    ambiguity_reason: ensureReason(confidence, reason),
  };
}

function resolveDeliverable(
  d: ExtractedDeliverable,
  ctx: DateResolutionContext,
): Deliverable {
  // A valid recurrence owns the dates; the deliverable's own due_date stays null.
  if (d.recurrence) {
    const r = d.recurrence;
    const days =
      r.days_of_week && r.days_of_week.length > 0 ? r.days_of_week : null;
    const bounded = r.end_date !== null || r.count !== null;
    if (r.start_date !== null && bounded) {
      const recurrence: Recurrence = {
        unit: r.unit,
        interval: r.interval,
        days_of_week: days,
        start_date: r.start_date,
        end_date: r.end_date,
        count: r.count,
      };
      return deliverable(d, null, recurrence, d.confidence, d.ambiguity_reason);
    }
    // Un-anchorable / unbounded cadence: drop it (documented v1 limitation).
    return deliverable(
      d,
      null,
      null,
      "low",
      d.ambiguity_reason ??
        "recurring cadence detected but its start date or extent could not be determined",
    );
  }

  // One-off with an absolute date already in hand.
  if (d.due_date !== null) {
    return deliverable(d, d.due_date, null, d.confidence, d.ambiguity_reason);
  }

  // One-off stated as a relative expression — resolve it.
  if (d.due_date_expression) {
    const res = resolveRelativeDate(d.due_date_expression, ctx);
    if (res.ok) {
      return deliverable(
        d,
        res.data,
        null,
        cap(d.confidence, "medium"), // inferred → never "high"
        d.ambiguity_reason ?? `date inferred from "${d.due_date_expression}"`,
      );
    }
    if (res.error.kind === "ambiguous" && res.error.date) {
      return deliverable(
        d,
        res.error.date,
        null,
        "low",
        d.ambiguity_reason ?? res.error.message,
      );
    }
    return deliverable(
      d,
      null,
      null,
      "low",
      d.ambiguity_reason ?? `could not resolve date "${d.due_date_expression}"`,
    );
  }

  // Dateless item (e.g. participation).
  return deliverable(d, null, null, d.confidence, d.ambiguity_reason);
}

export function resolveExtraction(
  extraction: Extraction,
  ctx: DateResolutionContext,
): ParseResult {
  return {
    course: extraction.course,
    deliverables: extraction.deliverables.map((d) =>
      resolveDeliverable(d, ctx),
    ),
  };
}
