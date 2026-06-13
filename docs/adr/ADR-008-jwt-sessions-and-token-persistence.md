# ADR-008: JWT sessions with custom encrypted token persistence (no Auth.js DB adapter)

## Status

Accepted — 2026-06-12

## Context

Coursecal uses Auth.js v5 with the Google provider. Sign-in must also yield a long-lived Google refresh token so the app can write to Google Calendar after the access token expires. Project security rules require refresh tokens to be encrypted at rest (AES-256-GCM, `TOKEN_ENCRYPTION_KEY`) and never logged or exposed.

Auth.js offers two session strategies:

1. **Database sessions via an adapter.** The adapter owns `users`, `accounts`, and `sessions` tables and stores provider tokens in the `accounts` table **in plaintext** — a direct conflict with the encryption-at-rest rule. Working around it means fighting the adapter's own persistence.
2. **JWT sessions with no adapter.** Auth.js touches no tables; the app owns all persistence. Session state lives in an encrypted JWE cookie sealed with `AUTH_SECRET`.

The data model (`COURSECAL.md` §7.1) already defines a custom `users` table with `google_id` and `encrypted_refresh_token`, which presumes option 2.

## Decision

**JWT session strategy, no database adapter.** Specifically:

- **User persistence is ours.** The sign-in callback upserts the `users` row keyed on `google_id` — created on first sign-in, name/image refreshed on return. A different Google account is simply a second independent user; no account linking in v1.
- **Refresh token capture.** The `jwt` callback receives the Google `account` object only on the sign-in that produced it. The refresh token is encrypted (AES-256-GCM) and written to `users.encrypted_refresh_token` at that moment — it is never available again until the next consent.
- **Access token in the session cookie.** The Google access token and its expiry travel in the JWT (an encrypted JWE, not a readable token). Calendar calls refresh it from the stored refresh token when expired.
- **Session lifetime: 7-day rolling `maxAge`.** Caps the stolen-cookie window at a week; active users pay one silent redirect bounce per week, with no consent screen.
- **Conditional consent.** `access_type: "offline"` on every sign-in; `prompt: "consent"` is never set on the normal sign-in path. A dedicated reconnect route forces it, reached via the existing 403 → re-auth path. First-time users see Google's consent screen anyway (new app to that account); returning users with a valid stored token never do; users whose stored token is dead are routed to reconnect exactly when consent is actually missing.

## Consequences

**Positive**

- The encryption-at-rest rule is satisfied structurally — no plaintext provider tokens exist anywhere in the database.
- Returning users never hit the consent wall; consent appears only when genuinely needed.
- No `accounts`/`sessions` tables to migrate or reconcile with the custom schema.

**Negative / accepted risks**

- **No instant server-side revocation.** A stolen session cookie works until expiry; the 7-day `maxAge` caps the window. A token-version column on `users` (bump to invalidate all sessions) remains available as a trivial additive migration if ever needed — deliberately not built now, since it would add a DB read to every session check for a threat this app's data sensitivity doesn't justify.
- **Refresh-token capture is a single moment.** If the encrypt-and-persist step fails on the originating sign-in, the token is lost; the reconnect flow recovers by forcing fresh consent. "Session exists but no usable Calendar token" is a designed-for state, not an error.

**Implementation note**

The exact Auth.js v5 API for passing authorization params (e.g. `prompt: "consent"`) on a per-`signIn()`-call basis must be verified against current docs at implementation time — the design does not depend on the call shape, but the code will.
