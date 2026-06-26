# Evals

Hand-rolled, stratified eval harness for `syllabus-parser` (COURSECAL.md §12.1). No
eval framework — just scripts that parse the fixtures, score the output against
hand-labeled ground truth, and write a JSON + markdown report. Honest numbers land in
`../docs/EVALS.md` and the library README.

## Layout

```
evals/
├── fixtures/<slug>/        real, hand-labeled syllabi (committed deliberately)
│   ├── syllabus.txt        extracted plain text — the parser input
│   ├── context.json        semester context (start/end/today/timezone, reading weeks, holidays)
│   ├── labels.json         ground truth, scored fields only (title, type, due_date, weight)
│   └── meta.json           stratification tags (format · discipline · recurrence)
├── cache/<hash>.json       recorded model responses — committed so replay is free
├── harness/                loader, record/replay client, matcher, scorer, baseline, report
├── run.ts                  orchestrate: parse-or-replay → score → write report
└── report/report.{json,md} generated report (committed reference)
```

## Running

```sh
pnpm eval:record    # parse every fixture, calling Anthropic on cache misses (spends tokens)
pnpm eval:replay    # re-score from the committed cache — deterministic, no API calls
pnpm eval:baseline  # run the regex baseline over the same fixtures (lift comparison)
```

`eval:replay` is the default for re-scoring: it reads the committed `cache/` and never
calls the API. `eval:record` only hits the API on a cache miss, so a fresh prompt
version (which changes the cache key) is the one thing that re-spends — by design.

## Stratification

Each fixture is tagged on three axes; the report buckets metrics by each:

- **format** — `table-heavy` · `prose` · `mixed`
- **discipline** — `STEM` · `humanities`
- **recurrence** — `recurring-heavy` · `one-off`

## Scoring (summary; full definitions in `../docs/EVALS.md`)

- **Deliverable detection** — greedy one-to-one match between predicted and ground
  truth on normalized-title similarity; **recall** (found / actual) is the headline,
  **precision** (matched / predicted) guards against hallucinated extras.
- **Type accuracy** — exact-enum match among matched pairs.
- **Date accuracy** — exact-day, split `explicit` vs `relative`; a ±1-day near-miss
  column for relative dates surfaces off-by-one weekday errors without inflating the headline.
- **Weight accuracy** — exact numeric match among matched pairs (secondary).
- Every miss gets a one-line categorized failure note.

Recurring items are scored as the library returns them: one deliverable carrying a
recurrence descriptor (expansion into rows is app logic, out of the library's scope).

## Discipline

Fixtures are **real, hand-labeled** syllabi — never generated. Labels are the source of
truth; the parser is scored against them. The harness and fixtures are off-limits to
unilateral changes (see `../CLAUDE.md`).
