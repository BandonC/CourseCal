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

- 2026-06-14: `shadcn` CLI removed from app `dependencies`; its base layer (`shadcn/tailwind.css` — accordion keyframes, `data-*` custom variants, `no-scrollbar`) is vendored to `app/shadcn-base.css` and imported from `globals.css`. shadcn init had added the CLI to runtime deps, which dragged in `@modelcontextprotocol/sdk` → a second zod (3.25.76); its `zod/v4/core` (version minor 0) was poisoning `@hookform/resolvers`' Zod v4 type inference against the 4.4.x `ParseResultSchema`. Vendoring the 95-line static base (shadcn components are owned in-repo anyway) lets the package go, leaving one zod (4.4.3) with no `pnpm` override needed. Future component adds still work via `npx shadcn@latest add`. [apps/coursecal / ui]
- 2026-06-14: shadcn/ui initialized with the default `base-nova` preset (shadcn 4.11) — its primitives are built on **Base UI** (`@base-ui/react`), the Radix team's successor, not Radix itself; `COURSECAL.md`'s "shadcn/ui" stack choice doesn't pin the underlying primitive lib, and base-nova is the current default. Init also rewrote `app/globals.css` with shadcn's token palette and switched dark mode from the `prefers-color-scheme` media query to a manual `.dark` class (`@custom-variant dark`). No `.dark` is applied anywhere yet, so the app is light-mode only until a theme toggle lands. [apps/coursecal / ui]
- 2026-06-14: Phase 2 parse server action runs unauthenticated with no per-user rate limit — the contract's `auth()`/`userId`-scoping and the mandated Postgres rate-limit counter both depend on the auth + DB that land in Phase 3. The only real server-side control in Phase 2 is the 200k-char input cap (`lib/parse/schema.ts`); the Anthropic account hard spend limit is the backstop. Phase 2 is local-only (no public endpoint), so the unauthenticated action is never exposed. A stopgap gate (in-memory counter / shared secret) was rejected as fake security that resets per cold start and is throwaway. TODO(phase-3): add `auth()` + `userId` scoping + DB-backed rate limit before any public deploy. [apps/coursecal / actions]
- 2026-06-13: syllabus-parser's public `parseSyllabus` context uses ISO date strings (`semesterStart`/`semesterEnd`/`today: string`), not `Date` as `COURSECAL.md` §8.1 sketches — converting a JS `Date` to a calendar date needs a timezone interpretation (`new Date("2026-09-07")` is UTC midnight; formatting it in America/Toronto yields the 6th), the off-by-one the ISO seam avoids. `timezone` stays in the context (passed to the prompt as data). Schema, resolver, and prompt are ISO end-to-end. Reconcile §8.1 wording. [packages/syllabus-parser]
- 2026-06-13: Scaffolded the app on Next.js 16 (not 15) — `COURSECAL.md`'s "15+" permits it and 16 is the current release; APIs verified against installed types rather than memory. [apps/coursecal]
- 2026-06-13: TypeScript pinned to `^5.9.x`, not 6.0 — Next 16, `eslint-config-next`, and `typescript-eslint` are tested against TS 5, and `create-next-app` deliberately resolves `eslint ^9` + `typescript ^5`. Revisit once the toolchain officially supports TS 6. [root / tooling]
- 2026-06-13: Tailwind v4 (CSS-first) — design tokens live in the `@theme` block in `apps/coursecal/app/globals.css`; there is no `tailwind.config.ts` (v4 dropped it from the default scaffold). Updated the app `CLAUDE.md` styling rule to match. [apps/coursecal / styling]
- 2026-06-12: Library carries its own `packages/syllabus-parser/.env` (with `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL`) loaded via dotenv in its test/eval scripts — Phase 1 builds the library standalone before the app exists, and Next.js only loads env from the app dir, so the library can't read `apps/coursecal/.env.local`. Keeps the library self-contained; the one shared key is duplicated by necessity. [packages/syllabus-parser]
- 2026-06-12: Reconnect route reserved at `app/(app)/reconnect` — forces `prompt=consent` for Calendar re-auth (ADR-008); the 403-permissions handler redirects here. Page-vs-action shape and the v5 consent-forcing mechanism settled at Phase 3. [auth / routing]
- 2026-06-12: PDF extraction is client-side (`unpdf` in the browser; server receives text only) — Vercel's ~4.5 MB request-body limit makes server-side file upload a non-starter; client extraction removes the size ceiling and keeps files off the server entirely. Server validates text length + rate limit instead. [lib/extract]
- 2026-06-12: `deliverables.due_date` is nullable — dateless items (e.g. participation, weight known but no date) are legitimate parser output; they count toward course weight totals but skip calendar export and weekly workload sums. [schema]
- 2026-06-12: Recurring expansion mapping — rows take the item's natural type (no `recurring_` variants in the DB enum), stated total weight split evenly per instance, shared nullable `series_id` stamped at expansion. Keeps conflict-detection sums correct; UI groups siblings to show series totals. v1 scope for `series_id`: display grouping, series delete, re-parse replacement only. Fold into ADR-005 when written. [schema / expansion]
- 2026-06-12: Calendar export uses chunked concurrent `events.insert` (5–10 in flight) instead of the HTTP batch endpoint — `googleapis` Node client has no batch support and batch requests give no quota benefit; exports made resumable by writing `google_event_id` per successful insert. [lib/calendar]
- 2026-06-12: Renamed `SENTRY_DSN` → `NEXT_PUBLIC_SENTRY_DSN` — the DSN is public by nature and client-side Sentry needs it in the bundle; without the prefix Next.js never exposes it to the browser.
