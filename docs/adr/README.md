# Architectural Decision Records

Non-trivial architectural decisions for Coursecal, in standard ADR form (Status /
Context / Decision / Consequences). Smaller implementation choices live in
[`../../DECISIONS.md`](../../DECISIONS.md); project scope and architecture live in
[`../../COURSECAL.md`](../../COURSECAL.md) (§12.5 lists the ADR set).

| ADR | Decision |
| --- | --- |
| [001](ADR-001-monorepo-over-multi-repo.md) | Monorepo over multi-repo |
| [002](ADR-002-server-actions-over-separate-backend.md) | Server actions over a separate backend |
| [003](ADR-003-drizzle-over-prisma.md) | Drizzle over Prisma |
| [004](ADR-004-pluggable-llm-client-interface.md) | Pluggable LLM client interface |
| [005](ADR-005-recurring-deliverables-as-expanded-rows.md) | Recurring deliverables stored as expanded rows |
| [006](ADR-006-aes-gcm-refresh-token-encryption.md) | AES-256-GCM for refresh-token encryption |
| [007](ADR-007-library-not-published-to-npm.md) | Library not published to npm in v1 |
| [008](ADR-008-jwt-sessions-and-token-persistence.md) | JWT sessions + custom encrypted token persistence, no Auth.js DB adapter |
