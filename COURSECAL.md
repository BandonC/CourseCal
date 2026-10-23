# Coursecal

> A web app that turns course syllabi into calendar events and a navigable semester plan.

> **About this document:** This is the canonical reference for the Coursecal project. It captures everything an engineer (or AI assistant) needs to understand and work on the project: what it does, why it exists, who it serves, how it's built, and what's intentionally out of scope. Treat it as living documentation — keep it updated as decisions change, and treat any drift between this document and the code as something to reconcile.

---

## Table of contents

1. [Project context](#1-project-context)
2. [Scope](#2-scope)
3. [User flows](#3-user-flows)
4. [Tech stack](#4-tech-stack)
5. [Repository structure](#5-repository-structure)
6. [Architecture](#6-architecture)
7. [Data model](#7-data-model)
8. [Library: syllabus-parser](#8-library-syllabus-parser)
9. [Authentication and security](#9-authentication-and-security)
10. [Build phases](#10-build-phases)
11. [Quality bars](#11-quality-bars)
12. [Engineering depth deliverables](#12-engineering-depth-deliverables)
13. [Cost model](#13-cost-model)
14. [Open questions and future decisions](#14-open-questions-and-future-decisions)
15. [Decision log pointer](#15-decision-log-pointer)

---

## 1. Project context

### 1.1 What it is
Coursecal is a web app that converts course syllabi into calendar events. Students upload or paste their syllabi at the start of each semester; the app extracts every graded deliverable (assignments, quizzes, exams, readings with deadlines, projects, presentations, participation requirements) and exports them to Google Calendar as structured events with reminders. The app also presents a semester timeline view with conflict detection — flagging hell weeks and clustered deadlines so students can see their term at a glance and plan around bottlenecks.

The codebase is structured as a small TypeScript library (`syllabus-parser`) plus a Next.js reference application (`coursecal`) that consumes it. The library boundary is clean and separable, but the library is not currently published to npm — the split exists for code organization and engineering signal, not external distribution.

### 1.2 The problem it solves
Every semester, every student manually copies deadlines from 4–6 syllabi into their calendar or planner. This is:
- **Tedious** — 30–60 minutes per semester minimum
- **Error-prone** — deadlines buried in prose are easy to miss
- **Repetitive** — every student, every term, on every campus

LMS platforms (Canvas, Moodle, Brightspace) sometimes auto-populate assignments, but coverage depends entirely on whether each professor configures it, and most don't. The result is that students keep doing this work manually despite the underlying problem being a perfect fit for automation.

### 1.3 Target user
Undergraduate and graduate students juggling multiple courses per semester. Initial target audience is the author's university; expansion happens via word of mouth among friends and study groups, not paid distribution.

### 1.4 Core value proposition
Upload your syllabi once → get a complete, accurate semester plan in Google Calendar → see your whole term at a glance with conflicts flagged. Replaces an hour of manual work with a few minutes of review.

### 1.5 Why this is a viable project
- **Universal, recurring pain** with a clear seasonal trigger (semester start)
- **LLM parsing** makes unstructured syllabi tractable in a way that wasn't possible pre-2023
- **No incumbent solving it well** — existing tools are LMS features with spotty adoption
- **The timeline + conflict detection view** is a genuine UX differentiator, not just a calendar export

### 1.6 Project goals (in priority order)
1. **Solve a personal pain point** — the author needs this tool
2. **Strong portfolio piece** — demonstrate full-stack engineering depth, real architectural thinking, and shipped work
3. **Useful to other students** — even a small number of real users substantially strengthens the project's value

### 1.7 Non-goals
- Building a startup or pursuing significant user growth
- Becoming a maintained open-source library with external contributors
- Competing with full-fledged study/productivity platforms (Notion, Todoist)
- Generating revenue

---

## 2. Scope

### 2.1 In scope for v1

**Application features:**
- Upload PDFs or paste raw text (for LMS-hosted HTML syllabi)
- Single or multi-syllabus upload in a session
- LLM parses each syllabus into typed structured output
- Review UI with confidence flags and inline editing
- Multi-syllabus semester timeline view with conflict detection
- Google OAuth login (single sign-on + Calendar API access)
- Persistent storage of parsed syllabi per user
- Export to Google Calendar with course-prefixed event titles
- Dashboard to view, edit, add, and delete semesters, courses, and deliverables with calendar sync
- iCal (.ics) export as fallback for non-Google users

**Engineering depth deliverables (see Section 12):**
- Eval harness with stratified test set and failure analysis
- Versioned prompt artifacts with iteration history
- Property-based testing for relative date resolution
- Conflict detection algorithm (density + clustering)
- Architectural Decision Records (ADRs)

### 2.2 Explicitly out of scope for v1
- Publishing the library to npm (clean boundary internally is sufficient)
- Multiple LLM provider implementations (Anthropic only; interface is pluggable but no other backends shipped)
- External blog posts, demo videos, launch posts (Show HN / Reddit / etc.)
- User recruitment campaigns
- "Start-early recommendations" — Layer 3 of conflict detection (see Section 12.4)
- Eval test set beyond ~10 syllabi (evaluated for v2 and kept out — the set already spans the structural axes; see DECISIONS 2026-07-05)
- ~~CI-integrated eval runs~~ — **added in v2 (2026-07):** a `$0` replay-mode gate over the committed response cache (no API key, no spend); `.github/workflows/evals.yml`
- Task/todo management, study planner, GPA tracker, social features
- Native mobile app
- ~~DOCX support~~ — **added in v2 (2026-07):** client-side `mammoth` extraction feeding the existing text-only parse action, mirroring the PDF path
- Automated update detection (re-upload with diff)
- Canvas/Moodle/Brightspace API integrations

### 2.3 Deferred (revisit only if user signal warrants)
- Semester-over-semester memory ("you used this last fall") — revisit if clusters of classmates from the same course appear; if built, match on an exact normalized-text hash (never course-code/term metadata) and cache de-identified extracted facts only. See DECISIONS 2026-07-03.
- Delta paste for quick updates ("Midterm moved to Oct 28")
- Separate email/SMS reminders
- Weekly digest emails
- Public npm distribution + maintenance
- ~~HTML-markup cleanup for pasted syllabi~~ — **added in v2 (2026-07):** `cleanPastedText` strips stray HTML via `DOMParser` when a paste looks like markup (no `html-to-text` dep); the plain textarea still yields plain text in the normal case

---

## 3. User flows

### 3.1 First-time user
1. Lands on marketing page, clicks "Get started"
2. Signs in with Google (OAuth consent includes Calendar access)
3. Prompted to enter semester name + start/end dates (used for resolving relative dates)
4. Upload screen: drag-and-drop PDFs, or paste text per course
5. App extracts text in the browser; server calls Claude for structured parsing
6. Review screen: each course grouped, deliverables listed, ambiguous items flagged
7. User edits/confirms, clicks "Export to Calendar"
8. Calendar events created via Google Calendar API; success confirmation + link
9. Lands on the semester timeline view at `/semester/[id]` (conflicts flagged); the dashboard aggregating all semesters is at `/dashboard`

### 3.2 Returning user (mid-semester update)
1. Signs in, lands on dashboard
2. Clicks into a course, sees existing deliverables
3. Edits a deliverable inline (e.g., date changed)
4. On save: app updates DB row, patches Google Calendar event via stored event ID
5. Toast confirms "Calendar updated"

### 3.3 New semester
1. Signs in, clicks "New semester"
2. Repeats flow from 3.1 steps 3–9
3. Old semester remains accessible in dashboard history

---

## 4. Tech stack

### 4.1 Locked decisions

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15+ (App Router) | One-stack deployment, server actions replace separate backend, built-in routing |
| Language | TypeScript (strict mode) | Type safety across LLM schema + DB + API boundaries |
| Styling | Tailwind CSS | Speed, no design-token bikeshedding |
| UI primitives | shadcn/ui | Unstyled-but-accessible, owned in-repo |
| Forms | React Hook Form + Zod | Type-safe validation; Zod schemas shared across LLM + forms |
| Auth | Auth.js with Google provider | OAuth + Calendar scope in one flow |
| Database | Neon Postgres | Vercel-native, branching for previews, clean Postgres-only scope |
| ORM | Drizzle | Closer to SQL than Prisma, faster iteration |
| LLM | Anthropic Claude Sonnet (official SDK) | Tool use for structured output, prompt caching |
| PDF extraction | `unpdf` | Pure JS, runs in-browser — extraction is client-side, dodging Vercel's body-size limit |
| Calendar | `googleapis` npm package | Official SDK |
| iCal export | `ics` npm package | Client-side, no API needed |
| Testing | Vitest + fast-check | Vitest for unit; fast-check for property-based testing |
| Hosting (app) | Vercel | Next.js first-class, zero-config deploys |
| Hosting (DB) | Neon | Generous free tier, branching |
| Error tracking | Sentry (free tier) | Standard, good Next.js integration |
| Analytics | PostHog (free tier) | Event tracking for product decisions |
| Package manager | pnpm | Workspace support, fast |

### 4.2 Non-choices
- No Redux/Zustand. URL params + server components + `useState` cover v1 needs.
- No separate backend. Server actions replace Flask.
- No Python services. JS-only stack.

---

## 5. Repository structure

### 5.1 Monorepo layout
A pnpm workspace with the library and app side by side:

```
/
├── packages/
│   └── syllabus-parser/        ← the library (not published; clean boundary)
│       ├── src/
│       │   ├── index.ts        ← public API
│       │   ├── parse.ts        ← core parse function
│       │   ├── schema.ts       ← Zod schemas + TS types
│       │   ├── prompts/        ← versioned prompt artifacts
│       │   ├── llm/            ← Anthropic client (interface for others)
│       │   └── dates/          ← relative-date resolution (pure)
│       ├── tests/
│       ├── evals/              ← eval harness + test set
│       ├── docs/
│       │   ├── DATES.md
│       │   ├── PROMPT_DESIGN.md
│       │   └── EVALS.md
│       ├── README.md
│       └── package.json
├── apps/
│   └── coursecal/              ← Next.js app
│       ├── app/
│       ├── components/
│       ├── lib/
│       │   ├── db/
│       │   ├── calendar/
│       │   ├── extract/
│       │   ├── auth/
│       │   └── conflict-detection/
│       ├── drizzle/
│       └── package.json
├── docs/
│   └── adr/                    ← architectural decision records
├── README.md                   ← top-level
├── COURSECAL.md                ← this doc
├── DECISIONS.md                ← running implementation-decision log
└── pnpm-workspace.yaml
```

### 5.2 Library boundaries
The library is a pure function: `parseSyllabus(text, context) → ParseResult`. It does not:
- Touch the filesystem
- Make HTTP calls except via the LLM client interface
- Persist anything
- Know about Google Calendar

The library does:
- Define and export the canonical types/schemas
- Own the prompt design and versioning
- Implement relative-date resolution as pure functions
- Provide a pluggable LLM client interface (Anthropic implementation included)

The app does everything else: PDF text extraction, auth, persistence, Calendar sync, UI, conflict detection.

The library ships no build artifacts in v1: the app consumes TypeScript source directly through the workspace (`transpilePackages`), and Vitest runs from source. No bundler, no `dist/` — npm publishing is out of scope, so there is nothing to package.

---

## 6. Architecture

### 6.1 System overview

```
[Browser]
    ├── PDF text extraction (unpdf, client-side)
    │ HTTPS (text only — files never uploaded)
    ▼
[Next.js on Vercel]
    ├── React Server Components (pages)
    ├── Server Actions (parse, save, sync)
    ├── Auth.js (Google OAuth, session)
    └── Conflict detection (density + clustering)
    │
    ├── consumes ──► [packages/syllabus-parser]
    │                    └── calls ──► [Anthropic API]
    ├──► [Google Calendar API]
    └──► [Neon Postgres] (via Drizzle)

Observability: Sentry (errors), PostHog (events) — client + server
```

### 6.2 Request flow: parsing
1. User drops a PDF; text is extracted **in the browser** via `unpdf` — the file never leaves the user's machine
2. Extracted text sent to a server action, which validates length cap + per-user rate limit
3. Server calls `parseSyllabus` from the library, passing semester context
4. Library calls Claude with structured tool-use prompt
5. Library validates response against Zod schema, returns typed result
6. Response sent back to client; review UI renders. **Nothing is persisted at parse time** — review and edits are in-memory over the `ParseResult`; persistence happens at export (§6.3, DECISIONS 2026-06-20)

### 6.3 Request flow: save + calendar sync
1. User reviews/edits, clicks "Add to Google Calendar"
2. Server re-validates each (client-edited) `ParseResult`, then persists the semester + its courses + recurrence-expanded deliverable rows in one atomic batch (the in-memory review becomes DB rows here; a multi-syllabus semester saves all its courses in the same batch)
3. Server reads the saved deliverables; events built from rows (dateless items skipped)
4. Chunked concurrent calls to Google Calendar API (5–10 in flight), access token refreshed from the stored refresh token
5. `google_event_id` saved back per successful insert (resumable — re-running skips already-synced rows)
6. Success/failure reported to client; revoked consent routes to the reconnect flow. `.ics` export remains the non-Google fallback

### 6.4 Request flow: edit and sync
1. User edits a deliverable inline
2. Server updates DB row
3. Server patches Calendar event via stored `google_event_id`
4. Errors handled: 404 → recreate, 401 → refresh token, 403 → backoff if rate-limit reason, re-auth if permissions reason
5. Toast confirms result

---

## 7. Data model

### 7.1 Tables (Drizzle schema shape)

**`users`**
- `id` (uuid, pk)
- `google_id` (text, unique, not null)
- `email` (text, not null)
- `name` (text)
- `image_url` (text)
- `timezone` (text, default 'America/Toronto')
- `encrypted_refresh_token` (text)
- `created_at`, `updated_at` (timestamps)

**`semesters`**
- `id` (uuid, pk)
- `user_id` (uuid, fk → users.id, cascade)
- `name` (text)
- `start_date`, `end_date` (date)
- `created_at` (timestamp)

**`courses`**
- `id` (uuid, pk)
- `semester_id` (uuid, fk → semesters.id, cascade)
- `name`, `code`, `instructor` (text; code/instructor nullable)
- `color` (text, for timeline)
- `original_syllabus_text` (text, retained for re-parse/debug)
- `created_at` (timestamp)

**`deliverables`**
- `id` (uuid, pk)
- `course_id` (uuid, fk → courses.id, cascade)
- `title` (text)
- `type` (enum: assignment, exam, quiz, project, reading, presentation, participation, other)
- `due_date` (date, nullable — null for dateless items like participation; these count toward course weight totals but skip calendar export and weekly workload sums)
- `due_time` (time, nullable)
- `weight_percent` (numeric, nullable)
- `notes` (text, nullable)
- `confidence` (enum: high, medium, low)
- `ambiguity_reason` (text, nullable)
- `google_event_id` (text, nullable)
- `series_id` (uuid, nullable — shared by all rows expanded from the same recurring item; null for one-offs)
- `created_at`, `updated_at` (timestamps)

**Recurring deliverables:** the library returns a recurrence descriptor; the server expands into N rows at save time. Keeps the data model flat and Calendar sync simple. Expansion rules: each row takes the item's natural `type` (a recurring quiz is a `quiz` — no `recurring_` variants in the enum); the stated total weight is split evenly across instances so week-level workload sums stay correct; all rows from one descriptor share a freshly generated `series_id`. The UI groups siblings via `series_id` for display ("Weekly quiz, 7 of 12 — 10% series"). In v1, `series_id` powers display grouping, series delete, and re-parse replacement only — no series-level edit UI.

### 7.2 Indexes
- `users.google_id` (unique)
- `semesters.user_id`
- `courses.semester_id`
- `deliverables.course_id`
- `deliverables.due_date`

### 7.3 Data retention
- Data is deleted only by explicit user action; deletion is hard (no soft-delete columns, no trash/undo) and removes both DB rows and their Calendar events
- Delete guards scale with blast radius: type-to-confirm for semesters and courses; a confirm dialog stating the instance count for series deletes ("Delete all 12 quizzes in this series?"); a simple confirm for single deliverables
- Deleting a semester cascades to courses + deliverables + Calendar events
- Minimal PII (email, name, Google ID); syllabus text retained for debugging

---

## 8. Library: syllabus-parser

### 8.1 Public API
```ts
parseSyllabus(
  text: string,
  context: {
    semesterStart: string;  // ISO YYYY-MM-DD
    semesterEnd: string;    // ISO
    today: string;          // ISO
    timezone: string;
    readingWeeks?: { start: string; end: string }[];
    holidays?: string[];    // ISO dates
  },
  options?: { llmClient?: LLMClient; dryRun?: boolean }
): Promise<Result<ParseResult, ParseError>>
```

- Returns a discriminated `Result` type, not throws
- `dryRun` returns the prompt without an LLM call (free, fast — useful for debugging)
- `llmClient` defaults to Anthropic. The interface is a test seam and eval record/replay point only — no multi-provider scaffolding ships in v1 (see §2.2)
- Context dates are ISO `YYYY-MM-DD` strings, not `Date` objects — converting a JS `Date` to a calendar date needs a timezone interpretation that introduces off-by-one bugs (`new Date("2026-09-07")` is UTC midnight, the 6th in `America/Toronto`). `timezone` is passed to the prompt as data; optional `readingWeeks`/`holidays` feed relative-date resolution. See `DECISIONS.md` (2026-06-13).

### 8.2 Output schema
- `course`: { name, code?, instructor?, semester_start, semester_end }
- `deliverables[]`: { title, type, due_date?, due_time?, weight_percent?, notes?, confidence, ambiguity_reason? } — `due_date` omitted for dateless items (e.g. participation); weight retained
- Recurring items: their natural `type` (e.g. `quiz`, `reading`) plus `recurrence: { pattern, day_of_week, start_date, end_date }`; `weight_percent` is the series total (the app splits it across instances at expansion)

### 8.3 Confidence levels
- `high` — title, type, date all explicit and unambiguous
- `medium` — inferred (relative date resolved, default applied)
- `low` — mentioned but critical info missing or contradictory

`ambiguity_reason` required for anything not `high`.

### 8.4 Date resolution (Section 12.3)
Relative-date resolution is a pure function in `dates/` with property-based test coverage. The LLM extracts expressions like "Week 6"; the resolver maps them to actual dates against semester boundaries. Edge cases include reading weeks, holidays, and non-standard expressions.

### 8.5 Prompt design (Section 12.2)
Prompts versioned in `prompts/` directory. `PROMPT_DESIGN.md` documents iteration history with eval scores per version.

---

## 9. Authentication and security

### 9.1 Auth flow
- Google OAuth via Auth.js with `calendar.events` scope upfront
- JWT session strategy, no DB adapter; `users` row upserted in the sign-in callback, keyed on `google_id` (see ADR-008)
- Session `maxAge` 7 days, rolling
- Refresh token persisted to DB (encrypted); access token in session
- `access_type=offline` on every sign-in; `prompt=consent` only on the dedicated reconnect route — returning users never see the consent wall
- Refresh on Calendar API calls when expired
- 403 with a permissions reason (revoked consent) → re-auth via the reconnect route; 403 with a rate-limit reason → backoff, never re-auth

### 9.2 Refresh token encryption
- AES-256-GCM, key in env (`TOKEN_ENCRYPTION_KEY`)
- Never logged or exposed in errors

### 9.3 Data isolation
- All DB queries scoped by `user_id` via session context
- No public endpoints accepting user IDs from client
- Row-level filtering in query layer

### 9.4 API key management
- Anthropic API key server-side only
- All LLM calls go through server actions
- Spending limit set on Anthropic account

### 9.5 Required env vars
```
DATABASE_URL=
DIRECT_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=
TOKEN_ENCRYPTION_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_SENTRY_DSN=
```

Validated at startup with Zod — fail fast on missing config. `ANTHROPIC_MODEL`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, and `NEXT_PUBLIC_SENTRY_DSN` are optional; everything else is required. `NEXT_PUBLIC_POSTHOG_HOST` selects the PostHog cloud region for ingestion (defaults to US — `https://us.i.posthog.com` — in code when unset); client events are reverse-proxied through the same-origin `/ingest` path (a `next.config.ts` rewrite) so ad-blockers don't drop them.

Separately, Sentry **source-map upload** reads build-time-only `SENTRY_AUTH_TOKEN` (with `org`/`project` set in `next.config.ts`). It is not part of the runtime Zod-validated set — when absent, builds still succeed and just skip upload (errors still report; prod traces stay minified). See `.env.example` and DECISIONS 2026-06-20.

---

## 10. Build phases

Loose sequencing — not a strict timeline. Ship each phase to friends for feedback before moving on.

> **Status (2026-06-28):** Phases 0–7 complete and deployed to production at **https://coursecal-lyart.vercel.app** (Vercel auto-deploys `main`). Phase 6 (PR #11): stratified eval harness (`packages/syllabus-parser/evals/`, `docs/EVALS.md`) + ADR-001–008 (`docs/adr/`). Phase 7 (PR #12): PostHog analytics (reverse-proxied `/ingest`, autocapture off, typed taxonomy in `lib/analytics/events.ts`), loading/error/empty/not-found states, mobile overflow fixes, marketing landing at `/`, and Sentry source-map upload. Sentry browser envelopes are tunneled through a same-origin `/monitoring` route (PR #13) so ad-blockers don't drop client crash reports. `NEXT_PUBLIC_POSTHOG_KEY`, `SENTRY_AUTH_TOKEN`, and `NEXT_PUBLIC_SENTRY_DSN` are set in Vercel and verified live. Deferred to Phase 8 (launch): root + profile READMEs (§11.3), a Content-Security-Policy (`next.config.ts`), MIT license, CI verification.

> **Status (2026-07-05):** Near-term v2 shipped (PR #23) — account deletion + data export (§14), `.ics` VALARM reminders, DOCX upload + paste HTML-cleanup (§2.2/§2.3), a printable per-semester schedule export, "add another course" from the export screen, one-click "to check" flag resolution, and a `$0` replay-mode eval gate in CI (§2.2, `.github/workflows/evals.yml`). Eval-set *expansion* was evaluated and dropped (the ~10-fixture set already spans the structural axes; see DECISIONS 2026-07-05). Phase 8 (launch) items still open: security headers + CSP, a standard typecheck/lint/test CI, READMEs, MIT license.

> **Status (2026-10-23):** Production moved to **https://coursecal.bandonc.com** (the `coursecal-lyart.vercel.app` URL 308-redirects). Phase 8 items closed: security headers + an enforcing nonce-based CSP (`proxy.ts`), MIT license, root README (with eval numbers) + a GitHub wiki, and `/privacy` + `/terms` pages. Google OAuth stays in Testing mode (invite-only). Still open: a standard typecheck/lint/test CI.

**Phase 0 — Setup (~1 week)**
Accounts, keys, monorepo scaffold, DB connection, Google OAuth, deploy empty app to Vercel.

**Phase 1 — Library skeleton + parsing (~2 weeks)**
Build `packages/syllabus-parser/` with parse function, prompts, schema, Anthropic client. Unit tests + property-based tests for date resolution. Library standalone, no app integration yet.

**Phase 2 — App: parse + review + .ics export (~1.5 weeks)**
App consumes library. No persistence. Upload → parse → review → download .ics. Validates end-to-end flow.

**Phase 3 — Persistence + Google Calendar export (~1.5 weeks)**
Auth, DB, token storage, Calendar sync with stored event IDs.

**Phase 4 — Multi-syllabus + timeline + conflict detection (~2 weeks)**
Multi-upload (multi-file dropzone feeding a sequential parse queue with per-file status — no parallel parsing), timeline visualization, conflict detection algorithm (density + clustering).

**Phase 5 — Dashboard + edit flow (~1 week)**
View all semesters/courses, inline edit, push updates to Calendar.

**Phase 6 — Engineering-depth deliverables (~1.5 weeks, partly parallel to earlier phases)**
- Eval harness with test set + failure analysis
- Prompt versioning + PROMPT_DESIGN.md (during Phases 1-2)
- ADRs (written as decisions are made throughout)

**Phase 7 — Polish (~1 week)**
Onboarding, empty/error states, loading UX, mobile responsiveness, PostHog wiring + event taxonomy, README, profile README.

**Phase 8 — Launch (cutover)**
Deploy to production, share with whoever you choose to share with.

**Estimated total:** ~13 weeks of focused work alongside school. Realistic for September if started in May/June.

---

## 11. Quality bars

### 11.1 Library
- TypeScript strict, no `any` in public API
- Unit tests for date resolution, schema validation, prompt formatting
- Property-based tests for relative date resolution
- Eval harness reports honest accuracy numbers in README

### 11.2 App
- Working end-to-end on production deployment
- Mobile-responsive (not mobile-first, but not broken)
- No unhandled promise rejections in Sentry
- Graceful degradation: token expiry, network failures, LLM errors all handled

### 11.3 Repo
- MIT license
- Clean commit history (squashed PRs, plain imperative commit subjects — no conventional-commit type prefixes; see root `CLAUDE.md`)
- GitHub Actions: typecheck + lint + tests on every PR
- README leads with screenshot, eval numbers, live demo link

---

## 12. Engineering depth deliverables

These are the explicit "portfolio depth" additions on top of normal feature work. Each is scoped to be cheap relative to its signal.

### 12.1 Stratified eval with failure analysis
- ~10 syllabi, hand-labeled ground truth
- Stratified by characteristics (table-heavy vs prose, STEM vs humanities, recurring-heavy vs one-off)
- Metrics: deliverable detection (recall), date accuracy on explicit dates, date accuracy on relative dates
- For every failure: one-line note categorizing the failure mode
- Baseline: a regex-based parser run on the same set, for lift comparison — timeboxed to ~half a day (date regex + keyword type classifier), one row in the eval table, never iterated on
- Harness is hand-rolled scripts producing a JSON/markdown report — no eval frameworks (promptfoo, Braintrust, etc.)
- Documented in `packages/syllabus-parser/docs/EVALS.md`
- Results section in library README with honest numbers

### 12.2 Prompt engineering as first-class artifact
- `packages/syllabus-parser/src/prompts/` directory with versioned prompts (`v1.ts`, `v2.ts`, ...) — TypeScript string exports, not `.txt`, since the library cannot read the filesystem at runtime (§5.2 purity); the filename carries the version
- `PROMPT_DESIGN.md` walks through iteration history: what each version added, what it fixed, what it broke, what eval score it achieved
- Documents schema design choices (why `confidence` levels, why structured `recurrence`, why `ambiguity_reason` required)

### 12.3 Property-based testing for date resolution
- Pure function `resolveRelativeDate(expression, semesterStart, semesterEnd) → Date`
- Lives in `packages/syllabus-parser/src/dates/` separate from the LLM
- Property-based tests via `fast-check`:
  - Resolved dates always within semester bounds
  - "Week N" is N-1 weeks after start
  - Idempotency on absolute-date input
- Edge cases: reading weeks, holidays, "Monday after spring break"
- Documented in `DATES.md`

### 12.4 Conflict detection algorithm
Layers 1+2 only for v1. Layer 3 explicitly out of scope.

**Layer 1: density flagging**
- Score each week by total workload
- Workload = sum of weighted deliverables (grade percentage if known; type-based defaults otherwise: exam > project > assignment > quiz > reading)
- Flag weeks above a threshold ("hell week")
- Visual: weeks colored by intensity in timeline

**Layer 2: conflict clustering**
- Cluster deliverables within a sliding window (configurable epsilon)
- Flag clusters that exceed thresholds (e.g., 3+ major deliverables in 5 days)
- Cross-course penalty: clusters spanning multiple courses get a multiplier (context-switching cost)
- Visual: clustered items grouped with a warning indicator

**Implementation:**
- Lives in `apps/coursecal/lib/conflict-detection/`
- Parameterized: `heavyWeekThreshold`, `clusterWindowDays`, `clusterSizeThreshold`, `crossCourseMultiplier`
- Unit-tested with hand-crafted scenarios
- Documented choices in a `README.md` within the module

### 12.5 Architectural Decision Records
~8 ADRs in `/docs/adr/`, following the standard template (context, decision, consequences):
- ADR-001: Monorepo over multi-repo
- ADR-002: Server actions over separate Flask backend
- ADR-003: Drizzle over Prisma
- ADR-004: Pluggable LLM client interface
- ADR-005: Recurring deliverables stored as expanded rows
- ADR-006: AES-GCM for refresh token encryption
- ADR-007: Library not published to npm in v1
- ADR-008: JWT sessions + custom encrypted token persistence, no Auth.js DB adapter (written)

Written as decisions are made, not retrofitted at the end.

---

## 13. Cost model

### 13.1 Free tier services
The locked stack is designed to run at zero infrastructure cost for v1 and well beyond.

| Service | Free tier | Sufficiency for v1 |
|---------|-----------|---------------------|
| Vercel (Hobby) | Unlimited deploys, 100 GB bandwidth/mo, serverless functions | Far exceeds need |
| Neon | 0.5 GB storage, 190 compute hours/mo, branching | Auto-suspend means real usage is a fraction of cap |
| Sentry (Developer) | 5K errors/mo, 10K performance events/mo | Sufficient |
| PostHog | 1M events/mo, session replays | Sufficient |
| GitHub | Unlimited repos, 2K Actions min/mo private (unlimited public) | Sufficient |
| Google Cloud (OAuth + Calendar API) | High quotas (1M Calendar requests/day) at no cost | Sufficient |

### 13.2 Variable cost: Anthropic API
The only meaningful ongoing cost is LLM usage.

**Estimated cost per syllabus parse** (Claude Sonnet, with prompt caching enabled): roughly $0.025

**At realistic v1 scale:**
- 50 users × 5 syllabi/semester ≈ a few dollars per semester
- 500 users × 5 syllabi/semester ≈ tens of dollars per semester

**Risk controls:**
- Hard spending limit on Anthropic account ($20/month is plenty for v1)
- Per-user rate limits in app (e.g., 10 syllabi/day max)
- Logging of every API call for cost monitoring

Note: pricing should be verified against current Anthropic rates before launch — figures above are order-of-magnitude estimates.

### 13.3 Optional cost: domain name
~$10–15/year for a real domain (e.g., `coursecal.app`). Optional — Vercel provides a free `.vercel.app` subdomain that works fine. Recommended for portfolio reasons; a custom domain meaningfully strengthens project presentation.

### 13.4 Total expected annual cost
- Strict zero-cost path: $0 infrastructure + ~$5–10/year API costs at low usage
- Recommended path with domain: ~$15/year + ~$5–10/month API costs once real users exist

---

## 14. Open questions and future decisions

- ~~**When to add account deletion / data export?** Before any meaningful user growth.~~ Done in v2 (2026-07) — `/account` page: PII-scoped JSON export + a type-to-confirm hard deletion (proceed-and-warn; revokes our own Google grant).
- **When to support non-Google calendars natively?** `.ics` export covers Apple/Outlook now; native deferred indefinitely.
- ~~**When to add DOCX support?** When users ask. Likely v1.5.~~ Done in v2 (2026-07) — client-side `mammoth` extraction.
- **When to revisit Python PDF service?** If `unpdf` misses >10% of deliverables across the test set.
- **When to publish library to npm?** Only if there's external demand, since maintenance is non-trivial.
- **Pricing?** Free for v1. Revisit only if hosting/Anthropic costs become meaningful.

---

## 15. Decision log pointer

For implementation-level non-obvious choices, see `DECISIONS.md`. For larger architectural choices, see `docs/adr/`. Examples that belong in `DECISIONS.md`:
- Why Neon pooled vs direct connection string
- Why specific clustering window defaults
- Why a particular Auth.js callback configuration
- Any reversal of decisions in this document

---

*This document is the project's source of truth for scope, architecture, and rationale. Treat any deviation in code as either (a) an update this doc needs to reflect, or (b) a bug. Keep it honest.*
