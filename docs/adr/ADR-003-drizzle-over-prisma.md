# ADR-003: Drizzle over Prisma

## Status

Accepted — 2026-06-12

## Context

Coursecal stores users, semesters, courses, and deliverables in Neon Postgres (`COURSECAL.md` §7) and needs a TypeScript ORM. The two mainstream choices are Prisma and Drizzle.

Prisma is mature and ergonomic but introduces its own schema DSL, a generated client, and (historically) a separate query engine binary — an extra layer between the code and SQL, and friction in serverless cold starts. Drizzle is a thinner, SQL-shaped query builder with schema defined in TypeScript and migrations generated from it.

## Decision

**Drizzle** as the ORM. Schema lives in `apps/coursecal/lib/db/schema.ts`; migrations are generated (`drizzle-kit generate`), reviewed, then applied manually against the dev branch first. Query helpers live in `lib/db/queries/`, each taking a `userId` and scoping the query — there is no global, unscoped query helper.

## Consequences

**Positive**

- Queries read close to SQL, which keeps the mental model honest and makes index-awareness easy to reason about (a rule in `apps/coursecal/CLAUDE.md`).
- Schema-as-TypeScript gives end-to-end inference without a separate generated client or engine binary — a good fit for serverless.
- Fast iteration: a schema edit plus `drizzle-kit generate` produces a reviewable SQL migration.

**Negative / accepted**

- Smaller ecosystem and fewer batteries-included conveniences than Prisma; some relational-query ergonomics are more manual.
- Drizzle's query-builder API has shifted across versions — code must be written against the installed version, not from memory (flagged in the root `CLAUDE.md` stale-prone list).

**Connection discipline** (also in `apps/coursecal/CLAUDE.md`): pooled `DATABASE_URL` for runtime queries, direct `DIRECT_URL` only for migrations.
