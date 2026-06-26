# ADR-002: Server actions over a separate backend

## Status

Accepted — 2026-06-12

## Context

Coursecal needs server-side logic: calling the parser (and thus the Anthropic API with a secret key), persisting to Postgres, syncing Google Calendar, and resolving the auth session. None of this can run in the browser — the API key, DB credentials, and refresh tokens are server-only.

The conventional split would be a separate backend service (Flask, Express, a Nest API) behind the Next.js frontend. That means a second deployable, a second language/runtime in some variants, a hand-written HTTP contract between front and back, and duplicated types across the boundary.

## Decision

**Next.js App Router server actions** for all server-side mutations; **no separate backend** (`COURSECAL.md` §4.2). Reads happen in async Server Components; writes happen in `"use server"` actions colocated with the route that uses them (or in `lib/actions/` when shared). The Anthropic call goes through an action; `googleapis` and Drizzle are only ever touched server-side.

## Consequences

**Positive**

- One deployable on Vercel, zero-config — no separate service to host, scale, or keep in sync.
- The client/server contract *is* the TypeScript function signature; the same Zod schema validates a form on the client and the action input on the server (no hand-written REST DTOs).
- Secrets stay server-side by construction — the action boundary is where `auth()` runs and queries are scoped by `userId`.

**Negative / accepted**

- Couples the app to Next.js and Vercel's execution model (e.g. the parse action's route segment must set `maxDuration`; long parses are treated as failures). Acceptable — the stack is already Next-on-Vercel (§4.1).
- Server actions are an evolving Next.js API; their caching/revalidation semantics must be verified against the installed version rather than assumed.

**Guardrails** (enforced in `apps/coursecal/CLAUDE.md`): every action validates input with Zod, resolves the session first, scopes DB queries by `userId`, and returns a typed `Result` rather than leaking raw errors.
