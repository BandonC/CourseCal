// Eval-harness domain types. The harness is a consumer of the library's public
// surface (it imports through src/index, the same entry the app uses) — it does
// not reach into internals. Fixtures are hand-labeled real syllabi (evals/README.md);
// these types describe the on-disk fixture shape and the scored ground truth.

import type { DeliverableType } from "../../src/index";

/** How a deliverable's date is stated in the syllabus — drives which date metric it counts toward. */
export type DateKind = "explicit" | "relative" | "none";

/** The three §12.1 stratification axes, tagged per fixture; the report buckets by each. */
export type FixtureMeta = {
  format: "table-heavy" | "prose" | "mixed";
  discipline: "STEM" | "humanities";
  recurrence: "recurring-heavy" | "one-off";
};

/** Recurring ground truth — the cadence descriptor, scored as one deliverable (see README). */
export type LabelRecurrence = {
  unit: "week" | "month";
  interval: number;
  count?: number | null;
  end_date?: string | null;
};

/**
 * One hand-labeled deliverable. Only the scored fields are required: title, type,
 * due_date, weight. `date_kind` tells the scorer whether the date counts toward the
 * explicit or relative accuracy bucket; `recurrence` (when present) marks a series.
 */
export type LabelDeliverable = {
  title: string;
  type: DeliverableType;
  due_date?: string | null; // ISO; null for dateless or recurring
  weight?: number | null; // series total for a recurring item
  date_kind: DateKind;
  recurrence?: LabelRecurrence | null;
};

export type Labels = {
  course: { code?: string | null; name: string };
  deliverables: LabelDeliverable[];
};

/** Per-fixture parse context — mirrors the library's SyllabusContext, ISO strings throughout. */
export type FixtureContext = {
  semesterStart: string;
  semesterEnd: string;
  today: string;
  timezone: string;
  readingWeeks?: { start: string; end: string }[];
  holidays?: string[];
};

/** One loaded fixture: the input (text + context), the ground truth (labels), and its strata (meta). */
export type Fixture = {
  slug: string;
  text: string;
  context: FixtureContext;
  labels: Labels;
  meta: FixtureMeta;
};
