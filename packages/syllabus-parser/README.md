# @coursecal/syllabus-parser

Turns one course syllabus's plain text into typed, validated structured output: a course plus every graded deliverable, with confidence flags and resolved dates. Pure library — no filesystem, no persistence, no Calendar knowledge; the one external effect (calling Claude) goes through a pluggable client seam. Consumed by the Coursecal app as TypeScript source through the workspace (no build step).

## Status

Phase 1 (parsing) is built: output schema, pure date resolution, versioned prompt **v1**, the Anthropic client, and `parseSyllabus`. The eval harness and honest accuracy numbers land in Phase 6 — **eval results: _TBD_**.

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
