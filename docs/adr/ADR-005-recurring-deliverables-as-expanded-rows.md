# ADR-005: Recurring deliverables stored as expanded rows

## Status

Accepted — 2026-06-12

## Context

Many syllabi state a cadence rather than a list: "weekly quiz", "reading response each week", "biweekly lab". The parser returns these as a structured `recurrence` descriptor (`unit`/`interval`/`days_of_week`/bounds) with the series-total weight (`COURSECAL.md` §8.2). The question is how the **app** persists them.

Two options:

1. **Store the descriptor.** One `deliverables` row carrying the recurrence rule; expand to concrete dates lazily (for display, conflict detection, Calendar export).
2. **Expand at save time.** Materialize the descriptor into N concrete dated rows.

Lazy storage keeps the row count small but pushes a recurrence-expansion step into every consumer: the timeline view, the density/clustering conflict algorithm (which sums weekly workload), and the Calendar sync (which needs one event per occurrence). Each would re-derive dates and risk drift.

## Decision

**Expand the descriptor into N flat rows at save time** (`COURSECAL.md` §7.1, `DECISIONS.md` 2026-06-12). Each expanded row:

- takes the item's **natural `type`** (a recurring quiz is a `quiz` — no `recurring_*` variants in the enum);
- gets the **stated total weight split evenly** across instances, so week-level workload sums stay correct;
- shares a freshly generated **`series_id`** with its siblings.

In v1, `series_id` powers display grouping ("Weekly quiz, 7 of 12 — 10% series"), series delete, and re-parse replacement — there is no series-level *edit* UI.

## Consequences

**Positive**

- The data model stays flat: every consumer (timeline, conflict detection, Calendar sync) reads plain dated rows with no expansion logic — one event per row, correct weekly workload sums.
- Conflict detection's density/clustering math operates on real per-occurrence dates without a special case.

**Negative / accepted**

- Row count grows with occurrences (a 12-week quiz is 12 rows) — trivial at this scale.
- Editing a whole series isn't a single-row update; v1 sidesteps this by scoping `series_id` to grouping/delete/replace only. Re-parse replaces the series wholesale (delete + insert) rather than diffing it.
- Even weight-splitting can produce rounding dust across instances; acceptable for workload visualization, which is approximate by nature.
