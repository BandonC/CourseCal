# ADR-007: Library not published to npm in v1

## Status

Accepted — 2026-06-12

## Context

`syllabus-parser` has a clean, separable public API (`parseSyllabus`, the Zod output schema, the `LLMClient` seam). A clean boundary invites the question of whether to publish it to npm as a reusable package.

Publishing carries real, ongoing cost: a build step and `dist/` artifacts, semantic versioning and changelogs, a release pipeline, API-stability guarantees to external consumers, and the maintenance burden of issues and compatibility. Becoming a maintained open-source library with external contributors is an explicit **non-goal** (`COURSECAL.md` §1.7), and the only consumer is the app in the same repo.

## Decision

**Do not publish the library to npm in v1** (`COURSECAL.md` §2.2, §5.2). The app consumes it as **TypeScript source** through the pnpm workspace (`transpilePackages`); there is no build, no `dist/`, no version, no release. The boundary is enforced by discipline (the purity rules in `packages/syllabus-parser/CLAUDE.md`), not by a package publish.

## Consequences

**Positive**

- Zero packaging overhead: no build step, no versioning, no release pipeline, no API-freeze obligations.
- The library and app refactor together in one commit — the clean boundary delivers its engineering benefit (separation of concerns, testability, the eval seam) without the distribution cost.
- Vitest runs the library directly from source; the app imports it directly.

**Negative / accepted**

- The library isn't independently reusable by outside projects — which is the point (a non-goal, §1.7).
- "Clean boundary" is enforced by convention rather than a hard package wall, so a careless import from the app into the library would compile. The subtree `CLAUDE.md` makes that boundary explicit (no app imports inside `src/`); the eval harness, notably, consumes the library only through its public `src/index.ts`.

Revisit only on genuine external demand (`COURSECAL.md` §14). Pairs with **ADR-001** (monorepo): together they make the split about code organization and engineering signal, not external distribution.
