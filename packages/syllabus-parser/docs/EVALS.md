# Evals

Stratified, hand-labeled accuracy eval for `syllabus-parser` (COURSECAL.md §12.1). The
harness is a few hundred lines of hand-rolled TypeScript — no eval framework — that
parses ten real syllabi, scores the output against hand-authored ground truth, and
writes `evals/report/report.{json,md}`. A regex baseline runs on the same set for a
lift comparison. The harness lives in `evals/`; running it is `pnpm eval:record` /
`eval:replay` / `eval:baseline` (see `evals/README.md`).

## Test set

Ten real undergraduate syllabi (University of Western Ontario, Fall 2025 / Winter
2026), extracted to plain text through the same pipeline the app uses (`unpdf` for
PDFs; DOCX paragraph text for the three Word outlines). Each fixture is a directory
under `evals/fixtures/<slug>/` holding `syllabus.txt`, `context.json` (the semester
context, derived from each syllabus's own stated term dates), `labels.json` (ground
truth — scored fields only), and `meta.json` (stratification tags). Fixtures and the
recorded model responses are committed deliberately, so the eval re-scores with no API
key and no spend.

**69 labeled deliverables**, stratified on three axes (the report buckets by each):

| Axis | Values (fixtures) |
| --- | --- |
| format | table-heavy (6) · prose (4) |
| discipline | STEM (8) · humanities (2) |
| recurrence | one-off (6) · recurring-heavy (4) |

The discipline split reflects the source corpus (mostly CS/math/science); the
humanities cell is small but non-empty. The set deliberately includes hard cases:
date-sparse "brief" outlines (`writ1025f`, `phil1230`), ungraded items that must be
*skipped* (`math1600b` weekly homework, `earthsci1086` mandatory-but-unweighted
integrity quiz), an internally contradictory date (`cs1020a` Test 2), and recurring
series stated as cadence vs enumerated tables.

## Metrics

Predicted deliverables are aligned to labels by **greedy one-to-one matching** on
normalized-title similarity (token-set Jaccard + a substring rule, with number-aware
blocking so "Quiz 1" never matches "Quiz 2"). From the alignment:

- **Recall** = matched / labeled — the headline "did it find the deliverables" number.
- **Precision** = matched / predicted — guards against hallucinated / ungraded extras.
- **Type accuracy** — exact enum match among matched pairs.
- **Explicit-date accuracy** — exact-day match for items whose label date is explicit,
  with a ±1-day diagnostic column for off-by-one weekday errors.
- **Relative-date accuracy** — exact-day for items whose label date is relative *and*
  resolvable to a single date. This corpus is explicit-date-dominant, so the
  denominator is tiny; relative-date resolution is covered far more thoroughly by the
  property-based tests (`tests/dates.property.test.ts`, §12.3).
- **Weight accuracy** — exact numeric match among matched pairs (secondary).
- **Recurrence detection** — did the parser emit a recurrence where the label expects a
  series.

Every miss produces a one-line categorized failure note (`missed` / `hallucinated` /
`wrong_type` / `wrong_date_explicit` / `wrong_date_relative` / `wrong_weight` /
`wrong_recurrence`). Recurring items are scored as the library returns them — one
deliverable carrying a recurrence descriptor; row-expansion is app logic, out of scope.

## Results

Prompt **v1**, model `claude-sonnet-4-6`. Numbers are from the committed response
cache via `pnpm eval:replay` — deterministic, so these exact figures reproduce. The
model itself samples, so a fresh `eval:record` varies by a few points run to run
(notably which ungraded items it over-extracts, and whether it enumerates a series);
the committed cache pins one honest run.

| System | Recall | Precision | Type | Explicit date | Relative date | Weight | Recurrence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **syllabus-parser v1** | **98.6%** | **90.7%** | 98.5% | **100.0%** | n/a¹ | 100.0% | 87.5% |
| regex baseline | 43.5% | 39.0% | 100.0%² | 15.0% | n/a¹ | 4.5% | 0.0% |

¹ No label in the set is a resolvable single relative date (the relative items are all
recurring series or genuinely unspecified, e.g. `phil1230`'s "~7th week"). The metric
is wired and reported, but n=0 here.
² The baseline only ever emits dated items and classifies by keyword, so its "type
accuracy among matches" is high on the few it matches — a misleading 100% that the
recall/precision columns put in context.

By stratum (parser): recall is 97.8–100% across format, discipline, and recurrence
buckets; explicit-date accuracy is 100% everywhere it applies. Precision is lowest on
the recurring-heavy and prose buckets (85.2% / 81.0%), where the ungraded extras live.

## Failure analysis

**1 miss and 7 false positives** across 69 deliverables, in a few honest modes:

- **Ungraded-item over-extraction (the dominant precision cost).** The parser pulled in
  items that carry no grade weight and should be skipped: `math1600b` "Homework
  Assignments" (ungraded), `earthsci1086` "Academic Integrity Quiz" + "ProctorTrack
  Onboarding" + makeup midterm, `cs1026a` "Orientation Quiz". This is consistent across
  record runs and the clearest prompt-improvement target — tighten the "graded
  deliverable" boundary (a v2 candidate; see `PROMPT_DESIGN.md`).
- **Recurrence handling is the unstable spot.** `earthsci1086` "Graded Quizzes" came
  back as a single dated item rather than a weekly series (recurrence 87.5%). In other
  record runs the model instead enumerated a numbered lab table into N one-offs — the
  recurrence-vs-enumeration boundary is where output varies most run to run, so it's the
  second v2 target.
- **A duplicate series row.** `cs1020a` got an extra "Quizzes (series total)" summary
  alongside the nine individual quizzes — a double-count, not a miss.
- **Title divergence (1 case).** `cs1020a` "zyBook exercises" was extracted as "ZyBooks
  Participation Activities" — too far apart for the matcher to align, counted as a miss
  + a false positive. A genuine titling difference, left as-is.

What it gets right: **100% explicit-date accuracy** (every stated calendar deadline,
across messy tables and prose), perfect recall on every prose and humanities fixture,
the dateless items it *should* keep (participation, final exams), and the contradictory
`cs1020a` Test 2 date resolved to the coherent value.

## Reproducing

```sh
pnpm eval:replay     # re-score from the committed cache — deterministic, no API calls
pnpm eval:baseline   # regex baseline only
pnpm eval:record     # re-parse via Anthropic on cache misses (spends tokens)
```

A new prompt version changes the cache key, so `eval:record` re-parses it (the rest
stay cached) — that is the versioning protocol, not a quirk.
