# Prompt design

How the syllabus-parser prompt is built, why the schema looks the way it does, and the per-version iteration history. See `COURSECAL.md` §8.5 / §12.2 and `../CLAUDE.md` (prompt-versioning protocol).

## Versioning protocol (summary)

Prompts are TypeScript string exports in `src/prompts/` (`v1.ts`, `v2.ts`, …) — not `.txt` files, because the library cannot read the filesystem at runtime (purity, §5.2). The filename carries the version. A prompt change is **never** an in-place edit to fix one parse failure: it is a new `vN.ts`, a new row in the history table below, and a re-run of the eval set (once the Phase 6 harness exists). `src/prompts/index.ts` re-exports the active version.

## Schema-design rationale

- **`confidence` (high/medium/low) on every deliverable.** Syllabi are messy; a parser that silently guesses is worse than one that flags what it inferred. Confidence drives the review UI's "needs a look" markers (§8.3).
- **`ambiguity_reason` required unless `high`.** Forces the model (and the resolver) to say _why_ something is uncertain, so the reviewer isn't left guessing. Enforced in the schema, not just prose.
- **Structured `recurrence` descriptor, expanded app-side.** The library returns a cadence (`unit`/`interval`/`days_of_week`/bounds); the app expands it into N rows at save time (§7.1). Keeps the library output compact and the DB rows flat. `weight_percent` on a recurring item is the series total.
- **Extraction vs. public schema split.** The tool's `input_schema` (what the model fills) carries an extra `due_date_expression` field for relative dates; the resolver converts it and the public `ParseResult` drops it. Keeps relative-date handling out of the model's hands (it extracts the phrase; the pure resolver maps it — see `DATES.md`).
- **Enumerated dates are not recurrence.** A syllabus that lists explicit dates yields N one-off deliverables, not a fake cadence. Recurrence is reserved for rule-stated cadence.

## Prompt-injection posture

Syllabus text is user-controlled content fed into an LLM (§9, `../CLAUDE.md`). The prompt fences it in `<syllabus>…</syllabus>`, declares it untrusted **data**, and instructs the model to extract facts only — never to follow instructions found inside it. The semester context (trusted, app-supplied) sits outside the fence.

## Version history

| Version | Date       | What it adds / changes                                                                                                                                                                                                                                               | What it fixed | What it broke | Eval score              |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------- | ----------------------- |
| v1      | 2026-06-13 | Initial prompt: course + graded-deliverable extraction via the `extract_syllabus` tool; injection fence; absolute-vs-relative date handling (`due_date` / `due_date_expression`); recurring-vs-enumerated rule; confidence + ambiguity rules; weight = series total. | — (baseline)  | —             | 98.6% recall · 100% explicit-date · 90.7% precision (see `EVALS.md`) |
| v2      | 2026-10-23 | Grade weight decides inclusion: an item is graded only if it carries a weight or a stated grade consequence; a deadline or "mandatory" doesn't qualify it. Explicit exclusions: zero-weight required items, admin/technical setup, alternate sittings (makeup/deferred → the original's notes), ungraded practice. Rest of the prompt unchanged from v1. | All ungraded-item over-extraction (5 false positives in every v1 run) | Nothing measured | 98.6% recall · 100% explicit-date · 97.1% precision (committed run; 98.6% on the second run) |

### v1 notes / known limitations

- **Relative recurrence anchors are not resolved in v1.** The model emits recurrence `start_date`/`end_date` as ISO directly; a cadence stated relative to the term ("weekly quizzes starting Week 2") is not run through the date resolver — if the model can't pin the anchor it lowers confidence. Candidate for v2 if it shows up in the eval set.
- **Single-`due_date` resolution only.** The post-extraction resolution pass resolves a deliverable's own `due_date_expression`; it does not yet resolve relative expressions embedded inside a recurrence descriptor.
### v2 notes

- **One change, measured over repeat runs.** v1 was re-recorded twice more (precision 78.8% and 91.9%; the committed run is 90.7%) and v2 twice (98.6%, 97.1%). The same five ungraded items appeared in all three v1 runs and in neither v2 run. Recall (98.6%), explicit-date (100%), and weight (100%) held in both v2 runs. The cache commits the second v2 run, which is the lower of the two.
- **Two other rules were tried and dropped before recording the final v2.** (1) "Never emit a series-total row beside enumerated occurrences" didn't remove the `cs1020a` summary row in either run. The syllabus gives a series weight ("Quizzes (7) 14%", best 7 of 9) with no per-quiz weight, and the schema has nowhere else to put a series weight for enumerated one-offs, so this needs a schema change, not a prompt change. (2) A rule that put occurrences listed in a weekly schedule without dates into a recurrence didn't fix `earthsci1086`. Together with a stricter one-off weight sentence, it also caused regressions: `calc1501b` lost its recurrence, and `ds1000a` lost its per-assignment weights in one run.
- **Tuned on the test set.** v2 was diagnosed and checked against the same ten fixtures, and there is no held-out set, so part of the precision gain is by construction. The rule is written as general categories with no examples copied from the fixtures to limit that, but new real syllabi are the real check.
- **Recurrence is still noisy.** It ranged from 75% to 87.5% across all v1 and v2 runs. `earthsci1086` comes back as a single dated item in every run, and `calc1501b` ("best 6 of 8", due dates on the LMS) flips between a recurrence and a single item. Temperature was left at the API default so v1 and v2 compare like for like.

### Candidates from the v1 eval

The Phase 6 eval (10 syllabi, 69 deliverables; `EVALS.md`) put v1 at **98.6% recall, 100% explicit-date accuracy, 90.7% precision** on the committed run. The precision gap — not recall — is where v1 leaves room, and the failures are specific enough to target:

- **Ungraded-item over-extraction (the main one) — fixed in v2.** v1 pulls in items with no grade weight that should be skipped: weekly homework presented as practice, mandatory-but-unweighted integrity/orientation quizzes, proctoring onboarding, makeup sittings. This is consistent across record runs. A v2 would sharpen the "graded deliverable" boundary — extract only items that carry weight or a stated grade consequence.
- **Recurrence handling is the unstable spot run-to-run — still open (see v2 notes).** Depending on the sample, a weekly series collapses to one dated item, or a numbered lab table gets enumerated into N one-offs instead of one recurrence. v2 should make "a stated weekly cadence is one recurrence" robust to a numbered table.
- **Occasional duplicate series row** — the individual occurrences *and* a "series total" summary for the same item. Still open: it needs a schema change (see v2 notes).

Per the protocol, addressing these is a new `v2.ts` + a row above + an `eval:record` re-run — not an in-place edit to this version.
