# Relative date resolution

`resolveRelativeDate(expression, ctx)` (in `src/dates/`) maps a syllabus date expression to a concrete ISO date, against semester boundaries. It is a **pure function** — no `Date.now()`, no date library, no timezone. All arithmetic runs on UTC-midnight instants, so DST never enters the picture; date-only resolution is timezone-independent. The library never knows a school's calendar — reading weeks and holidays are passed in (`COURSECAL.md` §12.3, `../CLAUDE.md` on purity).

```ts
resolveRelativeDate(expression: string, ctx: {
  semesterStart: string;            // ISO YYYY-MM-DD
  semesterEnd: string;              // ISO
  readingWeeks?: { start: string; end: string }[];
  holidays?: string[];              // ISO dates
}): Result<string, DateResolutionError>
```

## Supported expressions (v1)

| Form                                                 | Example                             | Resolves to                                                                                  |
| ---------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Absolute date (passthrough)                          | `2026-10-20`                        | itself (idempotent)                                                                          |
| `Week N`                                             | `Week 3`                            | `semesterStart + (N−1)×7 days`                                                               |
| `<Weekday> of Week N` / `Week N <Weekday>`           | `Monday of Week 6`, `Week 3 Friday` | that weekday on a Monday-aligned grid where Week 1 = the ISO week containing `semesterStart` |
| `<Weekday> after reading week` / `… after the break` | `Monday after reading week`         | first such weekday strictly after a reading-week range's end                                 |

Matching is case- and whitespace-insensitive.

## Reading weeks / holidays

- **Reference point** — the `after reading week` form needs **exactly one** `readingWeeks` range; zero or more than one returns `ambiguous` (unlabeled ranges can't be disambiguated by name).
- **Landing check** — if a resolved date falls on a holiday or inside a reading week, the resolver returns `ambiguous` **with the computed date attached**, so the caller can use it at lower confidence rather than silently asserting a deadline on a no-class day.

## Errors

| `kind`                    | Meaning                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `unrecognized_expression` | not one of the supported forms                                                                                 |
| `out_of_bounds`           | resolves outside `[semesterStart, semesterEnd]` (keeps the §12.3 "within bounds" property clean for successes) |
| `ambiguous`               | needs a reading-week range that wasn't unambiguously available, or lands on a no-class day (carries `date`)    |

## Property-based coverage (§12.3)

`tests/dates.property.test.ts` (fast-check): `Week N` is exactly N−1 weeks after start and within bounds; idempotency on absolute-date input; `Monday of Week N` always lands on a Monday within bounds.

## v1 limitations (deliberate)

- **Week numbering does not skip reading weeks.** `Week 8` is 7 calendar weeks after start even if a reading week intervenes. Whether reading weeks count as non-teaching weeks is school-dependent; baking a contested assumption is worse than the documented simple rule. Candidate for revisiting if the eval set shows it matters.
- **Relative recurrence anchors aren't resolved** (e.g. "weekly starting Week 2") — see `PROMPT_DESIGN.md`. Only a deliverable's own `due_date_expression` is resolved in v1.
