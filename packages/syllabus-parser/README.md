# @coursecal/syllabus-parser

Turns one course syllabus's plain text into typed, validated structured output: a course plus every graded deliverable, with confidence flags and resolved dates. Pure library — no filesystem, no persistence, no Calendar knowledge; the one external effect (calling Claude) goes through a pluggable client seam. Consumed by the Coursecal app as TypeScript source through the workspace (no build step).

## Status

Built: output schema, pure date resolution, versioned prompts (**v2** active), the Anthropic client, `parseSyllabus`, and the stratified eval harness with honest accuracy numbers (below).

## Results

Prompt **v2** (`claude-sonnet-4-6`) on ten real, hand-labeled syllabi (69 deliverables), stratified by format / discipline / recurrence. Full methodology and failure analysis in [`docs/EVALS.md`](docs/EVALS.md); regenerate with `pnpm eval:replay` (free — re-scores from the committed response cache).

| System | Recall | Precision | Type | Explicit-date | Weight | Recurrence |
| --- | --- | --- | --- | --- | --- | --- |
| **syllabus-parser v2** | **98.6%** | **97.1%** | 100% | **100%** | 100% | 87.5%¹ |
| syllabus-parser v1 | 98.6% | 90.7% | 98.5% | 100% | 100% | 87.5% |
| regex baseline | 43.5% | 39.0% | — | 15.0% | 4.5% | 0.0% |

Every stated calendar deadline is extracted to the exact day. v2 stopped v1's over-extraction of ungraded items (practice homework, required items worth no marks); the remaining extras are a series-total row and a title mismatch in one syllabus. Numbers are pinned by a committed response cache (`pnpm eval:replay` reproduces them exactly). The model samples, so a fresh `eval:record` varies: across repeat runs, v1's precision ranged from 78.8% to 91.9% and v2's from 97.1% to 98.6%. v2 was tuned on this same set, which has no held-out split; see `docs/EVALS.md`.

¹ The committed run. v2 scored 75% on recurrence in 2 of 3 runs: it often loses one recurring series (`calc1501b`) that v1 handled, so it isn't a strict improvement over v1.

## Usage

```ts
import { parseSyllabus } from "@coursecal/syllabus-parser";

const result = await parseSyllabus(syllabusText, {
  semesterStart: "2026-09-07", // ISO YYYY-MM-DD
  semesterEnd: "2026-12-07",
  today: "2026-09-01",
  timezone: "America/Toronto",
  readingWeeks: [{ start: "2026-10-12", end: "2026-10-16" }], // optional
  holidays: ["2026-10-13"], // optional
});

if (result.ok) {
  for (const d of result.data.deliverables) {
    console.log(d.title, d.due_date, d.confidence);
  }
} else {
  console.error(result.error.kind); // empty_input | input_too_large | llm_error | invalid_response
}
```

`parseSyllabus` returns a discriminated `Result`, never throws for expected failures. Pass `{ dryRun: true }` to get the assembled prompt back with **no** LLM call (free, fast). Pass `{ llmClient }` to inject a stub or an eval record/replay client.

The Anthropic client reads `ANTHROPIC_API_KEY` from the environment; the model id defaults to `claude-sonnet-4-6`, overridable via `ANTHROPIC_MODEL`. In standalone development the library loads its own `.env` (see `.env.example`).

## Docs

- `CLAUDE.md` — rules for working in this subtree (purity, schema discipline, prompt versioning, eval discipline).
- `docs/PROMPT_DESIGN.md` — prompt iteration history and schema-design rationale.
- `docs/DATES.md` — the relative-date resolver: supported expressions and edge cases.
- `docs/EVALS.md` — the stratified eval: method, metrics, results, and failure analysis.
- `evals/README.md` — how the harness, fixtures, and record/replay cache are laid out.
