# Evals

Stratified, hand-labeled accuracy eval for `syllabus-parser` (COURSECAL.md §12.1). The
harness is a few hundred lines of hand-rolled TypeScript — no eval framework — that
parses ten real syllabi, scores the output against hand-authored ground truth, and
writes `evals/report/report.{json,md}`. A regex baseline runs on the same set for a
lift comparison. The harness lives in `evals/`; running it is `pnpm eval:record` /
`eval:replay` / `eval:baseline` / `eval:check` (see `evals/README.md`).

A GitHub Actions job (`.github/workflows/evals.yml`) runs `eval:check` on every PR at
**`$0`** — replay against the committed cache, no `ANTHROPIC_API_KEY`, no spend. It
fails the build on any cache miss (a changed prompt/model must be re-recorded) or a
headline metric below its floor (recall / precision / explicit-date; added in v2).

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

Prompt **v2**, model `claude-sonnet-4-6`. Numbers come from the committed response
cache via `pnpm eval:replay`, so these exact figures reproduce. The model samples, so a
fresh `eval:record` varies run to run. To measure that, v1 was recorded on two more
runs and v2 on three (see "Run-to-run variance" below). The committed cache pins one
v2 run. It is the lowest of the three on precision but the best on recurrence (87.5%;
the other two scored 75%).

| System | Recall | Precision | Type | Explicit date | Relative date | Weight | Recurrence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **syllabus-parser v2** | **98.6%** | **97.1%** | 100.0% | **100.0%** | n/a¹ | 100.0% | 87.5% |
| syllabus-parser v1 | 98.6% | 90.7% | 98.5% | 100.0% | n/a¹ | 100.0% | 87.5% |
| regex baseline | 43.5% | 39.0% | 100.0%² | 15.0% | n/a¹ | 4.5% | 0.0% |

¹ No label in the set is a resolvable single relative date (the relative items are all
recurring series or genuinely unspecified, e.g. `phil1230`'s "~7th week"). The metric
is wired and reported, but n=0 here.
² The baseline only ever emits dated items and classifies by keyword, so its "type
accuracy among matches" is high on the few it matches — a misleading 100% that the
recall/precision columns put in context.

By stratum (v2): recall is 97.8–100% across format, discipline, and recurrence
buckets, and explicit-date accuracy is 100% everywhere it applies. Precision is 100%
on the prose, humanities, and recurring-heavy buckets and 95.7–96.8% elsewhere. The
remaining extras are all in `cs1020a`.

### Run-to-run variance

| Prompt | Run | Recall | Precision | Recurrence |
| --- | --- | --- | --- | --- |
| v1 | committed | 98.6% | 90.7% | 87.5% |
| v1 | repeat 1 | 97.1% | 78.8% | 85.7% |
| v1 | repeat 2 | 98.6% | 91.9% | 87.5% |
| v2 | repeat 1 | 98.6% | 98.6% | 75.0% |
| v2 | committed | 98.6% | 97.1% | 87.5% |
| v2 | repeat 2 | 98.6% | 97.1% | 75.0% |

Explicit-date accuracy was 100% in all six runs. The v1 precision dip (78.8%) came
from one run that split `cs1026a`'s numbered lab table into eleven one-off labs.
**v2 is not a strict improvement.** It lost `calc1501b`'s recurrence in 2 of 3 runs
(v1: 0 of 3), so v2's typical recurrence score is 75%, against v1's 85.7–87.5%. The
trade is about +6 points of precision for one flaky series.

v2 was diagnosed and checked against these same ten fixtures. There is no held-out
set, so part of the precision gain is by construction (see `PROMPT_DESIGN.md`).

## Failure analysis

v2's committed run has **1 miss and 2 false positives** across 69 deliverables:

- **A duplicate series row.** `cs1020a` gets an extra "Quizzes (series total)" summary
  next to the nine individual quizzes, a double count rather than a miss. The syllabus
  gives a series weight ("Quizzes (7) 14%", best 7 of 9) but no per-quiz weight, and
  the schema has no way to attach a series weight to enumerated one-offs, so the model
  uses a summary row. Fixing this needs a schema change, not a prompt change. It shows
  up in some runs of both prompts.
- **Title divergence (1 case).** `cs1020a` "zyBook exercises" is extracted as "ZyBook
  Participation Activities". The titles are too far apart for the matcher to align, so
  it counts as a miss plus a false positive. This is a genuine titling difference, left
  as is.
- **Recurrence is the unstable spot.** `earthsci1086` "Graded Quizzes" comes back as a
  single dated item rather than a weekly series in every run of both prompts.
  `calc1501b` ("Quizzes (best 6 out of 8)", due dates on the LMS) comes back as a
  single item in 2 of 3 v2 runs, a regression from v1, which got it right in all three
  runs. The committed run happens to get it right. A v2 rule aimed at recurrence was
  tried and dropped (`PROMPT_DESIGN.md`).

**Fixed in v2: ungraded-item over-extraction.** All three v1 runs extracted the same
five items that carry no grade weight: `math1600b` ungraded homework, `earthsci1086`
"Academic Integrity Quiz", "ProctorTrack Onboarding", and the makeup midterm, and
`cs1026a` "Orientation Quiz". Neither v2 run extracted any of them.

What it gets right: **100% explicit-date accuracy** (every stated calendar deadline,
across messy tables and prose), perfect recall on every prose and humanities fixture,
the dateless items it *should* keep (participation, final exams), and the contradictory
`cs1020a` Test 2 date resolved to the coherent value.

## Reproducing

```sh
pnpm eval:replay     # re-score from the committed cache — deterministic, no API calls
pnpm eval:check      # replay + assert (the CI gate): non-zero on a cache miss or a metric below floor
pnpm eval:baseline   # regex baseline only
pnpm eval:record     # re-parse via Anthropic on cache misses (spends tokens)
```

A new prompt version changes the cache key, so `eval:record` re-parses it (the rest
stay cached) — that is the versioning protocol, not a quirk.
