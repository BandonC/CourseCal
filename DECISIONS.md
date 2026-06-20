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

- 2026-06-20: Sentry wired for error reporting only; **source-map upload is deferred (TODO)**. `@sentry/nextjs` v10 with `instrumentation.ts` (server/edge init + `onRequestError`), `instrumentation-client.ts` (browser init + `onRouterTransitionStart`), and `withSentryConfig` in `next.config.ts`. Init is a no-op when `NEXT_PUBLIC_SENTRY_DSN` is unset; `tracesSampleRate: 0` (errors only, to spare the free perf quota); `sendDefaultPii: false`. **Not done yet:** readable prod stack traces need source-map upload, which requires `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (in Vercel) and the matching `org`/`project`/`authToken` options in `withSentryConfig`. Until then errors report but traces are minified. [apps/coursecal / observability]

<!-- Example:
- 2026-05-15: Conflict detection cluster window default = 5 days — based on observed clustering in author's own past semesters; tunable via constant in lib/conflict-detection/constants.ts.
- 2026-05-14: Use pooled connection (DATABASE_URL) for the eval CLI even though it runs once-off — Neon's direct connection has stricter concurrent-connection limits and pooled is fine for eval throughput.
-->

- 2026-06-20: Persistence happens at export, not at parse — the review screen edits the library's `ParseResult` in memory; "Add to Google Calendar" runs `saveSemesterAction` (which creates the semester + course + expanded deliverable rows in one `db.batch`) and then syncs. Reconciles `COURSECAL.md` §6.2 (which sketched save-immediately-after-parse) with §3.1 (review/edit precede the save); the in-memory review screen is reused untouched, and abandoning before export leaves no orphan semester. [apps/coursecal / actions]
- 2026-06-20: Calendar auth is refresh-token-only — `lib/calendar/client.ts` builds a `google.auth.OAuth2` from the stored encrypted refresh token and lets `google-auth-library` mint/refresh access tokens on demand. The access token carried in the JWT session (ADR-008) is not used for Calendar calls; the refresh token is the single source. A surfaced 401 (after the library already tried to refresh) is therefore terminal → reconnect. [apps/coursecal / lib/calendar]
- 2026-06-20: Reconnect forces consent via per-call authorization params — `signIn("google", { redirectTo }, { prompt: "consent", access_type: "offline" })` (verified against next-auth 5.0.0-beta.31), not a second provider instance. Settles the ADR-008 Phase-3 deferral. Reached from the `reconnect`-classified Calendar error, which also clears `users.encrypted_refresh_token` so the next consent re-captures a fresh token. [apps/coursecal / auth]
- 2026-06-20: User upsert runs in the `jwt` callback, not `signIn` — it's the only v5 callback that can thread the app `userId` into the token, so upsert + encrypted refresh-token capture happen together there; `signIn` only gates on a verified Google email. Overriding `authorization.params.scope` also means `openid` is listed explicitly alongside the three contract scopes (needed for the OIDC id_token). Both folded into ADR-008. [apps/coursecal / auth]
- 2026-06-20: Parse rate limit counts attempts (incl. failures), not successes — a failed parse still spends tokens, so `parse_events` records before the LLM call; cap is 10/rolling-24h (§13.2), `dryRun` exempt. The count-then-insert is intentionally non-atomic: a cost guard, not a security boundary, so a rare concurrent over-count is acceptable (no Redis, per the root contract). [apps/coursecal / actions]
- 2026-06-20: `courses.color` reuses the sanctioned `--chart-N` tokens from `globals.css` (stored as `var(--chart-N)`), not new color values — respects the styling rule. Phase 3 has one course per semester so it always picks index 0 (`courseColorForIndex`); Phase 4 distributes distinct colors across a semester's courses. [apps/coursecal / lib/courses]
- 2026-06-20: Known Phase-3 limitation — if a Calendar sync fails with revoked consent, the saved-but-unsynced course has no in-app resume path (re-running the upload flow would create a duplicate semester). Reconnect re-establishes the token for the *next* export; resuming a specific saved course's sync waits for the Phase-5 dashboard's per-course sync action. [apps/coursecal]

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
