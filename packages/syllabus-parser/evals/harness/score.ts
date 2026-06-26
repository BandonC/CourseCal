// Scorer: compares a parsed ParseResult against a fixture's ground-truth labels.
// Headline metric is deliverable-detection recall; precision guards against extras
// (the ungraded-item precision traps). Dates are scored exact-day, split explicit
// vs relative, with a ±1-day diagnostic. Every miss yields a categorized failure note.

import type { Deliverable, ParseResult } from "../../src/index";
import type { Fixture, FixtureMeta, LabelDeliverable } from "./types";
import { matchDeliverables } from "./match";

export type FailureKind =
  | "missed"
  | "hallucinated"
  | "wrong_type"
  | "wrong_date_explicit"
  | "wrong_date_relative"
  | "wrong_weight"
  | "wrong_recurrence";

export type Failure = { kind: FailureKind; detail: string };

export type Counts = {
  labels: number;
  predicted: number;
  matched: number;
  typeMatched: number;
  explicitTotal: number;
  explicitExact: number;
  explicitWithin1: number;
  relativeTotal: number;
  relativeExact: number;
  relativeWithin1: number;
  weightTotal: number;
  weightExact: number;
  recurrenceTotal: number;
  recurrenceDetected: number;
};

export type FixtureScore = {
  slug: string;
  meta: FixtureMeta;
  counts: Counts;
  failures: Failure[];
};

export function emptyCounts(): Counts {
  return {
    labels: 0,
    predicted: 0,
    matched: 0,
    typeMatched: 0,
    explicitTotal: 0,
    explicitExact: 0,
    explicitWithin1: 0,
    relativeTotal: 0,
    relativeExact: 0,
    relativeWithin1: 0,
    weightTotal: 0,
    weightExact: 0,
    recurrenceTotal: 0,
    recurrenceDetected: 0,
  };
}

export function addCounts(a: Counts, b: Counts): Counts {
  const out = emptyCounts();
  for (const k of Object.keys(out) as (keyof Counts)[]) out[k] = a[k] + b[k];
  return out;
}

function daysApart(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return Number.POSITIVE_INFINITY;
  return Math.abs(Math.round((da - db) / 86_400_000));
}

function weightEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01;
}

export function scoreFixture(fixture: Fixture, result: ParseResult): FixtureScore {
  const predicted = result.deliverables;
  const labels = fixture.labels.deliverables;
  const counts = emptyCounts();
  const failures: Failure[] = [];

  counts.labels = labels.length;
  counts.predicted = predicted.length;

  const { matches, unmatchedPred, unmatchedLabel } = matchDeliverables(
    predicted.map((d) => d.title),
    labels.map((d) => d.title),
  );
  counts.matched = matches.length;

  for (const l of unmatchedLabel) {
    const label = labels[l];
    if (label) failures.push({ kind: "missed", detail: label.title });
  }
  for (const p of unmatchedPred) {
    const pred = predicted[p];
    if (pred) failures.push({ kind: "hallucinated", detail: pred.title });
  }

  for (const m of matches) {
    const pred = predicted[m.predIdx];
    const label = labels[m.labelIdx];
    if (!pred || !label) continue;
    scorePair(pred, label, counts, failures);
  }

  return { slug: fixture.slug, meta: fixture.meta, counts, failures };
}

function scorePair(
  pred: Deliverable,
  label: LabelDeliverable,
  counts: Counts,
  failures: Failure[],
): void {
  // Type
  if (pred.type === label.type) {
    counts.typeMatched++;
  } else {
    failures.push({
      kind: "wrong_type",
      detail: `${label.title}: predicted ${pred.type}, expected ${label.type}`,
    });
  }

  // Date — only scored where the label carries a concrete expected date.
  if (label.due_date) {
    const explicit = label.date_kind === "explicit";
    if (explicit) counts.explicitTotal++;
    else counts.relativeTotal++;
    const exactBucket = explicit ? "explicitExact" : "relativeExact";
    const within1Bucket = explicit ? "explicitWithin1" : "relativeWithin1";
    const kind: FailureKind = explicit ? "wrong_date_explicit" : "wrong_date_relative";

    if (pred.due_date && pred.due_date === label.due_date) {
      counts[exactBucket]++;
      counts[within1Bucket]++;
    } else if (pred.due_date && daysApart(pred.due_date, label.due_date) <= 1) {
      counts[within1Bucket]++;
      failures.push({
        kind,
        detail: `${label.title}: predicted ${pred.due_date}, expected ${label.due_date} (±1)`,
      });
    } else {
      failures.push({
        kind,
        detail: `${label.title}: predicted ${pred.due_date ?? "null"}, expected ${label.due_date}`,
      });
    }
  }

  // Weight (secondary) — scored whenever the label states a weight.
  if (label.weight != null) {
    counts.weightTotal++;
    if (pred.weight_percent != null && weightEq(pred.weight_percent, label.weight)) {
      counts.weightExact++;
    } else {
      failures.push({
        kind: "wrong_weight",
        detail: `${label.title}: predicted ${pred.weight_percent ?? "null"}, expected ${label.weight}`,
      });
    }
  }

  // Recurrence — did the parser produce a recurrence where the label expects one?
  if (label.recurrence) {
    counts.recurrenceTotal++;
    if (pred.recurrence) counts.recurrenceDetected++;
    else failures.push({ kind: "wrong_recurrence", detail: `${label.title}: no recurrence detected` });
  }
}
