# ADR-004: Pluggable LLM client interface

## Status

Accepted — 2026-06-12

## Context

The `syllabus-parser` library's one external effect is calling Claude. The library is otherwise a pure function (`COURSECAL.md` §5.2): no filesystem, no persistence, no network except this one call. Two needs pull on how that call is structured:

1. **Testability.** Unit tests must exercise the parse pipeline (prompt assembly → schema validation → date resolution) without hitting the network or spending tokens.
2. **Eval record/replay.** The Phase 6 eval harness (§12.1) must record real model responses once and replay them deterministically, for free, on every re-score.

At the same time, v1 ships **one** provider (Anthropic) — multiple LLM backends are explicitly out of scope (§2.2). The risk is over-building a provider-abstraction layer nobody needs.

## Decision

Put the model call behind a narrow **`LLMClient` interface** (`src/llm/types.ts`): a single `extract(req) → Result<unknown, LlmError>` method. `AnthropicLLMClient` is the only shipped implementation. `parseSyllabus` accepts an optional `llmClient` in its options and defaults to the Anthropic one.

The seam exists as a **test stub and eval record/replay point — not as multi-provider scaffolding.** No second provider, no provider registry, no config to swap backends.

## Consequences

**Positive**

- The library stays pure: the sole effect is injected, so tests pass a stub and the eval passes a record/replay client (see the eval harness — the `RecordReplayLLMClient` wraps the real one and caches responses on disk).
- The Anthropic-specific surface (`@anthropic-ai/sdk`, tool-use shape, model-id strings, prompt caching) is contained in one file behind the interface.
- Deterministic, zero-cost eval re-scoring follows directly from the seam.

**Negative / accepted**

- A one-method interface around a single implementation looks like indirection — justified only because it is the test + eval seam, not because a second provider is coming. If multi-provider is ever in scope, the interface is already the extension point, but nothing is built for it now (YAGNI).
