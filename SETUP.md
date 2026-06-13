# SETUP.md

First-time setup for working on Coursecal. This walks through the external accounts, keys, and environment values needed before you can run the project locally.

Plan for ~2–3 hours. Have a password manager or a scratch text file ready to collect keys as you go.

If you are returning to this project on a new machine, skip to [Existing project, new machine](#existing-project-new-machine) at the bottom.

---

## 1. Local toolchain

### Node.js 24+

If you don't have it, install via `nvm`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 24
nvm use 24
node --version    # should print v24.x or higher
```

### pnpm

```bash
npm install -g pnpm
pnpm --version
```

### Git

Most systems have it. Verify with `git --version`. Configure your identity if you haven't:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Editor (recommended)

VS Code with the following extensions:

- Tailwind CSS IntelliSense
- ESLint
- Prettier
- Drizzle ORM (auto-completion for Drizzle queries)

---

## 2. GitHub repository

Create a private repo named `coursecal` on github.com. Do **not** initialize it with a README — the local scaffold will create one.

Clone it locally:

```bash
git clone git@github.com:yourusername/coursecal.git
cd coursecal
```

If SSH isn't set up, use HTTPS with a Personal Access Token, or run `gh auth login` if you have the GitHub CLI.

---

## 3. Google Cloud — OAuth + Calendar API

Budget 30–45 minutes for this section. It's the most involved.

### 3.1 Create a project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Top bar → project dropdown → **New Project**.
3. Name: `coursecal`. Create.

### 3.2 Enable the Calendar API

1. Left sidebar → **APIs & Services** → **Library**.
2. Search "Google Calendar API".
3. Click it → **Enable**.

### 3.3 Configure the OAuth consent screen

1. **APIs & Services** → **OAuth consent screen**.
2. User type: **External**. Create.
3. Fill in:
   - App name: `Coursecal`
   - User support email: yours
   - Developer contact email: yours
4. **Save and continue.**
5. **Scopes** step → **Add or remove scopes**. Add:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `https://www.googleapis.com/auth/calendar.events`
6. **Update** → **Save and continue.**
7. **Test users** step: add your own Gmail address. You can add up to 100 testers without going through Google's verification process — plenty for v1.
8. **Save and continue.**

### 3.4 Create OAuth credentials

1. **APIs & Services** → **Credentials**.
2. **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Coursecal Web`.
5. **Authorized JavaScript origins:** `http://localhost:3000`
6. **Authorized redirect URIs:** `http://localhost:3000/api/auth/callback/google`
7. **Create.**
8. A modal appears with **Client ID** and **Client Secret**. Copy both immediately. You can re-access them later from the Credentials page.

> When you eventually deploy to a production URL (e.g., `coursecal.vercel.app` or a custom domain), come back here and add the production origin and redirect URI to this same OAuth client.

---

## 4. Anthropic API

### 4.1 Sign up

1. Go to [console.anthropic.com](https://console.anthropic.com).
2. Sign up. Verify the current free credit amount on the console.

### 4.2 Create an API key

1. Left sidebar → **API Keys**.
2. **Create Key**, name it `coursecal-dev`.
3. Copy the key immediately — it's shown only once.

### 4.3 Set a spending limit

1. **Settings** → **Limits** (or **Plans & billing**).
2. Set a monthly hard cap. **$20/month** is more than enough for development plus early users.
3. This protects against runaway costs from bugs.

---

## 5. Database — Neon Postgres

### 5.1 Create a project

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub auth recommended).
2. **New Project**.
3. Name: `coursecal`.
4. Postgres version: latest (default is fine).
5. Region: pick the one closest to where you'll deploy on Vercel. **US East (Ohio or Virginia)** is a safe default.
6. **Create.**

### 5.2 Grab connection strings

The dashboard shows a connection string after creation. You need **two**:

- **Pooled connection** — has `-pooler` in the hostname. This is shown by default. Used by the app at runtime.
- **Direct/unpooled connection** — toggle the "Pooled connection" option **off** in the dashboard's connection details to see this. Used only for migrations.

Copy both.

---

## 6. Hosting — Vercel

### 6.1 Sign up

1. Go to [vercel.com](https://vercel.com).
2. Sign up with GitHub.
3. Authorize Vercel to access your repos (you can scope to specific repos).

You won't deploy yet — wait until there's code. The account just needs to exist.

---

## 7. Optional: domain name

A custom domain (e.g., `coursecal.app`) costs ~$10–15/year on [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) or [Namecheap](https://namecheap.com).

Skip if you want — Vercel's free `.vercel.app` subdomain works for v1. Recommended for portfolio purposes once the project is live, since a custom domain meaningfully strengthens project presentation.

---

## 8. Optional: observability (do later, before launch)

These can be skipped until the app actually exists and there's something to monitor. Set up before launch.

- **Sentry:** [sentry.io](https://sentry.io) → create project (Next.js platform). Copy the DSN.
- **PostHog:** [posthog.com](https://posthog.com) → create project. Copy the project key.

---

## 9. Generate local secrets

Two values are generated locally rather than fetched from a service:

```bash
# AUTH_SECRET — used by Auth.js to sign session cookies
openssl rand -base64 32

# TOKEN_ENCRYPTION_KEY — used to encrypt stored Google refresh tokens
openssl rand -hex 32
```

Save both.

---

## 10. Create `.env.local`

In `apps/coursecal/` — **not the repo root**. Next.js only loads env files from the app directory, and Drizzle Kit resolves them relative to its config there too:

```bash
cd apps/coursecal
cp .env.example .env.local
```

Fill in `.env.local` with everything collected above. **Never commit `.env.local`** — `.gitignore` should already cover it.

Required values for local dev to run:

- `DATABASE_URL` (Neon pooled)
- `DIRECT_URL` (Neon direct)
- `AUTH_SECRET` (generated locally)
- `AUTH_GOOGLE_ID` (Google OAuth client ID)
- `AUTH_GOOGLE_SECRET` (Google OAuth client secret)
- `ANTHROPIC_API_KEY` (Anthropic console)
- `TOKEN_ENCRYPTION_KEY` (generated locally)

Optional (skip until needed):

- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `ANTHROPIC_MODEL` (pin to a specific model identifier; verify against current Anthropic docs before setting)

### Library env (Phase 1, before the app exists)

Phase 1 builds `packages/syllabus-parser/` standalone — its tests and eval harness call the Anthropic API before `apps/coursecal/` exists. The library does **not** read the app's `.env.local`. It carries its own `packages/syllabus-parser/.env` (gitignored; a committed `.env.example` is added when the package is scaffolded) with just:

- `ANTHROPIC_API_KEY` (required for live-parse tests and evals)
- `ANTHROPIC_MODEL` (optional)

The library's test/eval scripts load it via `dotenv`. Date-resolution property tests and `dryRun` parsing need no key. This is the same `ANTHROPIC_API_KEY` value as the app's — the duplication is unavoidable since Next.js only loads env from the app directory.

---

## 11. Sanity check

Before starting any code work:

- [ ] `node --version` shows 24+
- [ ] `pnpm --version` works
- [ ] Git configured with name and email
- [ ] GitHub repo created and cloned locally
- [ ] Google Cloud project created with Calendar API enabled
- [ ] OAuth consent screen configured with the three required scopes + your email as a test user
- [ ] OAuth Client ID and Secret saved
- [ ] Anthropic account exists with API key and a spending limit set
- [ ] Neon project created with both pooled and direct connection strings saved
- [ ] Vercel account exists (no project yet)
- [ ] `AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY` generated locally
- [ ] All values in `apps/coursecal/.env.local`

If everything checks out, you're ready to scaffold the project. The next step is initializing the pnpm workspace, creating the Next.js app, and configuring the rest of the stack.

---

## Existing project, new machine

If you're returning to Coursecal on a different machine and the project is already scaffolded:

```bash
# 1. Clone
git clone git@github.com:yourusername/coursecal.git
cd coursecal

# 2. Install
pnpm install

# 3. Get .env.local from your password manager (or recreate from .env.example)
cp apps/coursecal/.env.example apps/coursecal/.env.local
# fill in values

# 4. Verify DB access
pnpm drizzle-kit check

# 5. Run
pnpm dev
```

You don't need to redo the Google Cloud / Anthropic / Neon setup — those are project-level, not machine-level. The keys carry over.
