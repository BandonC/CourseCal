# ADR-001: Monorepo over multi-repo

## Status

Accepted — 2026-06-12

## Context

Coursecal is two pieces: the `syllabus-parser` library (pure parsing, schema, prompts, date resolution) and the `coursecal` Next.js app that consumes it (auth, DB, Calendar, UI). The library boundary is deliberately clean and separable (`COURSECAL.md` §5.2), which raises the question of repository layout: one repo holding both, or a repo each.

Separate repos would force the library to be versioned and released (npm or a git dependency) for the app to consume it, and every cross-cutting change — a schema field that touches both the parser's output and the app's persistence — would span two repos and two PRs.

## Decision

**A single pnpm-workspace monorepo** with `packages/syllabus-parser/` and `apps/coursecal/` side by side. The app consumes the library as **TypeScript source through the workspace** (`transpilePackages`), not as a built or published artifact — no `dist/`, no version bumps, no release step (see ADR-007).

## Consequences

**Positive**

- Cross-cutting changes (e.g. a new field on the parser's Zod output and the matching DB column) land in one atomic commit/PR, with the type checker enforcing both sides at once.
- Shared tooling: one TypeScript base config, one lint setup, one `pnpm install`. Vitest runs the library from source.
- No internal package versioning or publish dance to consume the library locally.

**Negative / accepted**

- The two subtrees can't be released or deployed independently — acceptable, since the library is explicitly not published (ADR-007, §2.2) and the app is the only consumer.
- A monorepo needs workspace-aware tooling (pnpm, `transpilePackages`); this is a one-time setup cost.

This decision is paired with ADR-007 (no npm publish): together they say the boundary exists for **code organization and engineering signal**, not external distribution (§1.1).
