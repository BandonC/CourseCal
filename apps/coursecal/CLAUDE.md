# CLAUDE.md — apps/coursecal (Next.js app)

This file adds rules specific to the **coursecal** Next.js app. The root `CLAUDE.md` and `COURSECAL.md` apply globally — read them first. This file does **not** repeat universal rules; it only adds app-specific ones.

For the app's design — request flows, data model, auth, calendar sync, conflict detection — read `COURSECAL.md` Sections 6–9 and 12.4.

---

## Stack at this level

- **Next.js 15+, App Router.** Server Components by default. Client components are explicitly marked with `"use client"` and only used when interactivity requires it.
- **Server actions** for all server-side mutations. No separate API routes for things server actions can do.
- **Drizzle** as the ORM. Schema lives in `lib/db/schema.ts`. Migrations in `drizzle/`.
- **Auth.js** (NextAuth v5+) with Google provider. Config in `lib/auth/`.
- **shadcn/ui** components live in `components/ui/`. They are owned in-repo, not installed from a package.
- **Tailwind** for styling. No CSS modules, no styled-components. Utility-first.
- **React Hook Form + Zod** for any form. Zod schemas shared with server-side validation.

---

## React rules

- Functional components only. No class components.
- Server components by default. Use a client component only when you need state, effects, browser APIs, or event handlers. The decision should be deliberate, not reflexive.
- Don't reach for `useEffect`. If something can be derived from props or state, derive it. `useEffect` is for synchronizing with external systems.
- No `useMemo`/`useCallback` without a measured reason.
- Don't fetch in client components if a server component can do it. Server components can be `async`.

---

## Server actions

- All server actions live in `app/.../actions.ts` next to the route that uses them, or in `lib/actions/` if shared.
- Every server action validates its input with Zod. The Zod schema is the contract.
- Every server action that touches user data resolves the session first and scopes queries by `userId`. No exceptions.
- Server actions return discriminated `Result` types when failure is expected. Throw only for genuinely unexpected errors.
- Server actions should be small. If one is doing five things, split it.

```ts
// shape to follow
type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
```

---

## Drizzle rules

- Schema in `lib/db/schema.ts`. Migrations are generated, not hand-written, unless I explicitly say so.
- After any schema change: `pnpm drizzle-kit generate` to produce a migration file. Review it. Only then `pnpm drizzle-kit migrate` to apply.
- **Never apply migrations from a deploy script.** Migrations are run manually against the dev branch first, verified, then promoted.
- Use the **pooled** connection string (`DATABASE_URL`) for runtime queries from the app. Use the **direct** connection (`DIRECT_URL`) only for migrations.
- Query helpers go in `lib/db/queries/`. They take a `userId` and scope the query — there is no "global" query helper that returns rows across users.

```ts
// shape to follow
export async function getSemestersForUser(userId: UserId) {
  return db.select().from(semesters).where(eq(semesters.userId, userId));
}
```

---

## Auth rules

- The Auth.js config in `lib/auth/` requests scopes upfront: `userinfo.email`, `userinfo.profile`, `https://www.googleapis.com/auth/calendar.events`.
- **Sessions are JWT — there is no Auth.js DB adapter** (see ADR-008). The `users` row is upserted in the sign-in callback, keyed on `google_id`. Session `maxAge` is 7 days, rolling.
- The refresh token only exists in the `jwt` callback on the sign-in that produced it. Encrypt and persist it there — there is no second chance until the next consent.
- `access_type: "offline"` on every sign-in. Never `prompt: "consent"` on the normal sign-in path — only the dedicated reconnect route forces it (reached via the 403 re-auth path).
- The refresh token is persisted to the DB encrypted with `TOKEN_ENCRYPTION_KEY` (AES-256-GCM). Never store it in plaintext, never log it, never include it in error messages.
- Session resolution helpers are in `lib/auth/session.ts`. Use those — don't call Auth.js APIs directly from random server actions.
- A session that exists but lacks a usable Calendar token is a real state. Handle it: either refresh, or prompt re-auth gracefully. Don't let the UI hang.
- 401 from a Calendar call → refresh the access token using the stored refresh token, retry once. If that fails, prompt re-auth.
- 403 from a Calendar call → inspect the error reason first. `rateLimitExceeded`/`userRateLimitExceeded` are quota signals — back off like a 429. `insufficientPermissions` (or `invalid_grant` during refresh) means revoked consent — mark tokens invalid and route to the reconnect flow.

---

## Google Calendar API

The Calendar wrapper lives in `lib/calendar/`. Treat it as the only place that talks to `googleapis`.

- **Always store `google_event_id`** when creating events. It's the key for later updates and deletes.
- **Always patch by `google_event_id`**, never create-on-update. Two edits in quick succession must not produce two events.
- When creating many events, use chunked concurrent inserts (5–10 in flight at a time). Naive serial calls are too slow; do **not** hand-roll the multipart HTTP batch endpoint — the `googleapis` Node client dropped batch support, and batch gives no quota benefit anyway (inner requests count individually).
- Exports are resumable: write `google_event_id` back to the row after each successful insert, not transactionally at the end. Retrying an export skips rows that already have an event ID.
- Implement exponential backoff for 429s and 5xx — and for 403s whose reason is `rateLimitExceeded`/`userRateLimitExceeded` (Google signals quota via 403 too). Don't retry other 4xx except 401.
- 404 on patch (event was deleted manually in Google Calendar) → offer to recreate, don't silently fail.
- All Calendar timestamps include the user's timezone explicitly. Don't rely on server local time.

---

## PDF extraction and paste input

Extraction lives in `lib/extract/` — client-side modules.

- **PDFs are extracted in the browser** via `unpdf` (client component); only extracted text is sent to the server. Vercel's ~4.5 MB request-body limit rules out server-side file upload, and the PDF never needs to leave the user's machine.
- The parse server action accepts text only — it validates length and rate limit, never files.
- **Pasted syllabi** come in through a plain `<textarea>` — the browser strips markup on paste, so the input is already plain text. No HTML processing, no `html-to-text` in v1 (deferred; see `COURSECAL.md` §2.3).
- The library (`syllabus-parser`) takes plain text. The app's job is to give it good plain text.
- If extraction fails (encrypted PDF, corrupted file, empty output), surface a useful error to the user. Don't pass an empty string to the library and expect it to handle it.

---

## Conflict detection

The conflict detection code lives in `lib/conflict-detection/`. See `COURSECAL.md` Section 12.4 for the algorithm.

- **Layers 1+2 only.** "Start-early recommendations" (Layer 3) is explicitly out of scope until I say otherwise.
- The algorithm is parameterized: `heavyWeekThreshold`, `clusterWindowDays`, `clusterSizeThreshold`, `crossCourseMultiplier`. These are not magic numbers in the code — they're constants in one file with comments explaining the default values.
- No user-facing tuning UI for these parameters in v1 — constants only.
- The module has its own `README.md` documenting choices and tradeoffs. Update that file when the algorithm changes.
- Unit tests cover hand-crafted scenarios (a known hell-week case, a clean-week case, a cross-course cluster case). Don't change defaults without updating these tests.

---

## Routing conventions

- **Authed routes** live in `app/(app)/`. The layout enforces session.
- **Public routes** (marketing, login) live in `app/(auth)/` or as siblings.
- **Reconnect route** lives at `app/(app)/reconnect` — the server-side 403-permissions handler redirects here, and it triggers a `signIn` that forces `prompt=consent` (see ADR-008). Page-vs-pure-action shape is settled at Phase 3; verify the v5 mechanism for forcing consent on this flow only (per-call authorization params, or a second provider instance) before building.
- **Per-route server actions** colocated as `actions.ts` in the same directory as the route's `page.tsx`.
- URL params for filters and views (e.g., `?semester=fall2026`). Use `nuqs` if it gets unwieldy.
- Page-level data fetching happens in the server component (the `page.tsx`). Pass data down to client components as props.

---

## Forms

- **React Hook Form + Zod resolver.** Standard.
- **Server validation is the source of truth.** Client validation is for UX, not security.
- The same Zod schema validates the form on the client and the server action input on the server. Define it once.
- Don't build custom form state machines. Use RHF.

---

## Styles

- **Tailwind utility classes** for layout and styling. Don't generate giant inline `style={{}}` objects.
- **shadcn/ui components** for primitives (Button, Dialog, Toast, etc.). Don't reinvent them.
- **No new design tokens or color values.** Tailwind v4 is CSS-first — tokens live in the `@theme` block in `app/globals.css`, not a `tailwind.config.ts`. Use what's there. If you genuinely need a new color, ask first. The shadcn token set written into `globals.css` at init (`--background`, `--primary`, `--muted`, `--border`, etc., plus the `.dark` block) is the sanctioned baseline — build on those tokens; don't add new ones without asking.
- **The timeline view is CSS grid/flex.** No charting or visualization libraries (d3, recharts, visx) — it's deliverables on a time axis, not a chart.
- Mobile responsiveness matters. The app should work on a phone — not be mobile-first, but not broken on a phone either.

---

## Observability

- **Sentry** captures errors. Use it on the server side for unhandled errors and on the client for the same.
- **PostHog** captures product events. Names should be snake_case verbs: `syllabus_uploaded`, `export_to_calendar_clicked`, `deliverable_edited`.
- PostHog wiring lands in Phase 7 — don't add events before then. Sentry is live from the first deployed phase onward.
- Don't log PII (email, name, refresh tokens, syllabus content) to either.
- Console logs in shipped code are removed. Use real telemetry.

---

## Performance

- **Parse progress is client-queue state.** LLM parses take 10–60s. The upload queue shows per-file status (queued / parsing / done / failed) from client state, with an indeterminate spinner per parse — no status table, no polling, no streaming machinery. The parse action's route segment must export `maxDuration` (60s on Hobby — verify the current ceiling against Vercel docs).
- **Don't over-fetch.** A semester page does not need every deliverable's notes pre-loaded if they're only shown on click.
- **Indexes exist for a reason.** If you write a query that's not hitting an index (no `WHERE` on an indexed column, or `LIKE '%foo%'`), call it out.
- If a server component is slow because of a chained DB call, look at parallelizing with `Promise.all` before reaching for caching.

---

## Common Next.js gotchas to watch for

- Server actions that read `cookies()` or `headers()` need to handle the async nature in current Next.js versions.
- `"use client"` cascades — once a file is a client component, everything it imports for direct use also runs on the client.
- Don't import server-only modules from client components. Use `import "server-only"` to enforce on the server side.
- File-based routing means moving a `page.tsx` changes the URL. Confirm with me before reorganizing routes.
- `cache` and `revalidatePath`/`revalidateTag` semantics change across Next versions — verify against the current docs if you're using them.

If you're not sure about a Next.js behavior in the current version, say so — don't generate plausible-looking code from older patterns.

---

## Information I may need to provide you (app-specific)

If you need any of these and they aren't in the codebase, **ask before guessing**:

- **Specific Google OAuth scopes** if a new feature needs Calendar capabilities beyond `calendar.events`.
- **Production Vercel URL** for redirect URIs and CORS — needed when configuring or updating Google Cloud OAuth credentials.
- **Custom domain** if/when one is set up (currently optional per `COURSECAL.md` Section 13.3).
- **Anthropic model identifier** — the architecture says "Claude Sonnet"; the actual model string is in env or a constants file. Ask if you don't see it.
- **Whether to prefer pooled or direct DB connection** for an unusual task (default: pooled for runtime, direct for migrations).
- **Concrete date ranges, holidays, or reading week dates** for my university, if a feature needs them.
- **Whether to add a new env var or reuse an existing one** when integrating a new service.

---

## Things you do NOT decide unilaterally (app-specific)

For all of these: propose, wait for approval, then implement.

- Modifying `lib/db/schema.ts` (DB schema changes need explicit approval and a migration plan)
- Adding a new server action that doesn't scope by `userId`
- Changing auth flow, session shape, or token handling
- Adding a new third-party API integration (calendar provider, email, etc.)
- Changing the conflict detection parameters or algorithm
- Adding a new top-level route group under `app/`
- Modifying the encryption helpers in `lib/auth/`

These are in addition to the project-wide list in the root `CLAUDE.md`.