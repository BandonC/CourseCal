# DECISIONS.md

Running log of small implementation decisions made during development. The point of this file is to capture *why* things were done a certain way so future-me (or future collaborators) doesn't have to reverse-engineer the reasoning.

## How to use this file

- **Add an entry** when you make a non-obvious implementation choice — something where future-you would wonder "why did I do it this way?"
- **One-line entries are fine.** Format: short reasoning, dated, optionally tagged.
- **For bigger architectural choices,** write an ADR in [`docs/adr/`](./docs/adr/) instead. ADRs have more structure (context, decision, consequences). DECISIONS.md is for the smaller stuff that doesn't justify an ADR.
- **For project-level scope and architecture**, see [`COURSECAL.md`](./COURSECAL.md). Don't duplicate that here.

## Format

```
- YYYY-MM-DD: <what you decided> — <one-line why>. [optional: relevant file/area]
```

## Examples of what belongs here

- Default values for tunable parameters (e.g., conflict detection thresholds)
- Choice between similar approaches in a small area (e.g., pooled vs direct DB connection for a specific script)
- Workarounds for library quirks
- Naming conventions adopted mid-project
- Reversal of a previous choice (link to the original entry if applicable)

## What does NOT belong here

- Day-to-day code changes (that's what git history is for)
- Architecture-level decisions (write an ADR)
- Bug fixes (commit messages cover those)
- Decisions that are already documented in `COURSECAL.md` or a `README.md`

---

## Decisions

<!-- Add new entries at the top. Newest first. -->

<!-- Example:
- 2026-05-15: Conflict detection cluster window default = 5 days — based on observed clustering in author's own past semesters; tunable via constant in lib/conflict-detection/constants.ts.
- 2026-05-14: Use pooled connection (DATABASE_URL) for the eval CLI even though it runs once-off — Neon's direct connection has stricter concurrent-connection limits and pooled is fine for eval throughput.
-->

- 2026-06-12: Library carries its own `packages/syllabus-parser/.env` (with `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`) loaded via dotenv in its test/eval scripts — Phase 1 builds the library standalone before the app exists, and Next.js only loads env from the app dir, so the library can't read `apps/coursecal/.env.local`. Keeps the library self-contained; the one shared key is duplicated by necessity. [packages/syllabus-parser]
- 2026-06-12: Reconnect route reserved at `app/(app)/reconnect` — forces `prompt=consent` for Calendar re-auth (ADR-008); the 403-permissions handler redirects here. Page-vs-action shape and the v5 consent-forcing mechanism settled at Phase 3. [auth / routing]
- 2026-06-12: PDF extraction is client-side (`unpdf` in the browser; server receives text only) — Vercel's ~4.5 MB request-body limit makes server-side file upload a non-starter; client extraction removes the size ceiling and keeps files off the server entirely. Server validates text length + rate limit instead. [lib/extract]
- 2026-06-12: `deliverables.due_date` is nullable — dateless items (e.g. participation, weight known but no date) are legitimate parser output; they count toward course weight totals but skip calendar export and weekly workload sums. [schema]
- 2026-06-12: Recurring expansion mapping — rows take the item's natural type (no `recurring_` variants in the DB enum), stated total weight split evenly per instance, shared nullable `series_id` stamped at expansion. Keeps conflict-detection sums correct; UI groups siblings to show series totals. v1 scope for `series_id`: display grouping, series delete, re-parse replacement only. Fold into ADR-005 when written. [schema / expansion]
- 2026-06-12: Calendar export uses chunked concurrent `events.insert` (5–10 in flight) instead of the HTTP batch endpoint — `googleapis` Node client has no batch support and batch requests give no quota benefit; exports made resumable by writing `google_event_id` per successful insert. [lib/calendar]
- 2026-06-12: Renamed `SENTRY_DSN` → `NEXT_PUBLIC_SENTRY_DSN` — the DSN is public by nature and client-side Sentry needs it in the bundle; without the prefix Next.js never exposes it to the browser.
