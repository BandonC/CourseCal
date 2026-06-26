# ADR-006: AES-256-GCM for refresh-token encryption

## Status

Accepted — 2026-06-12

## Context

To write to Google Calendar after the user's access token expires, Coursecal must persist the Google **refresh token** server-side and use it to mint fresh access tokens. A refresh token is long-lived and high-value: leaking it means durable access to the user's Calendar.

The project's security rules (root `CLAUDE.md`) require refresh tokens to be **encrypted at rest** and never logged, never returned to the client, never put in an error message. The Auth.js DB-adapter path would store provider tokens in plaintext (the reason ADR-008 rejects it), so the app owns token persistence and therefore owns the encryption.

The data model already reserves `users.encrypted_refresh_token` (`COURSECAL.md` §7.1). The open choice is the encryption scheme.

## Decision

Encrypt the refresh token with **AES-256-GCM**, keyed by `TOKEN_ENCRYPTION_KEY` from the environment (`COURSECAL.md` §9.2). Encryption happens in the Auth.js `jwt` callback at the one moment the Google `account` object is available, and the ciphertext is written to `users.encrypted_refresh_token`. Decryption happens only inside the Calendar layer when minting an access token. The plaintext token is never logged, never returned to the client, never included in an error.

## Consequences

**Positive**

- GCM is **authenticated** encryption: it provides confidentiality *and* integrity (the auth tag detects tampering), so a modified ciphertext fails to decrypt rather than yielding garbage.
- Implemented with Node's built-in `crypto` — no KMS, no external secret service, no added dependency or cost (fits the zero-infra-cost goal, §13).
- Satisfies the encryption-at-rest rule structurally: no plaintext provider token exists anywhere in the database.

**Negative / accepted**

- Key management is on us: `TOKEN_ENCRYPTION_KEY` lives in env, and rotating it would require re-encrypting stored tokens (or forcing reconnect). Acceptable at this scale; a documented operational task rather than built tooling.
- A correct GCM implementation must use a fresh random IV per encryption and store it with the ciphertext + tag — an implementation rule, enforced in the `lib/auth/` encryption helpers (which `apps/coursecal/CLAUDE.md` marks off-limits to casual edits).

Pairs with **ADR-008**: JWT sessions with no DB adapter is precisely what makes the app — not Auth.js — responsible for this encrypted persistence.
