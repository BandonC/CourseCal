import { NextResponse, type NextRequest } from "next/server";

// Content-Security-Policy with a per-request nonce (COURSECAL.md §11.3 / root
// CLAUDE.md security headers). App Router emits inline framework scripts (the RSC
// flight payload, hydration bootstrap) that can't be hashed, so a nonce is the
// only way to get a script-src that actually protects anything — Next detects the
// nonce in the request Content-Security-Policy header and stamps it onto every
// script it renders. `'strict-dynamic'` then lets those nonced scripts load the
// chunk graph, while `'self'` stays as the fallback for pre-CSP3 browsers.
//
// Reading the nonce in the root layout opts every route into dynamic rendering —
// intended: a nonce baked at build time wouldn't match the request, so nothing
// may be statically generated. This app is per-user dynamic already, so the cost
// is ~nil.
//
// Same-origin proxying is what keeps the rest of the policy tight: PostHog goes
// through the /ingest rewrite and Sentry through the /monitoring tunnel, so
// connect-src is just 'self'. next/font self-hosts at build time, so font-src is
// 'self' too. img allows Google avatar URLs; style-src keeps 'unsafe-inline'
// because React sets inline style attributes (low-risk, not script).

// Enforcing. Set back to true to fall back to report-only (violations logged to
// the console, not blocked) — the safe mode for vetting a policy change against a
// full pass (parse → save → export, sign in/out, PostHog in prod) before letting
// it block anything. The initial rollout ran report-only until that pass was clean.
const REPORT_ONLY = false;

// `next dev` needs eval (React Fast Refresh) and a dev websocket (HMR) that the
// strict prod policy would block. These relaxations are dev-only — production
// (build/Vercel, NODE_ENV=production) keeps the strict policy. Without this, a
// flip to enforcing would white-screen local dev.
const IS_DEV = process.env.NODE_ENV === "development";

function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(IS_DEV ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://lh3.googleusercontent.com`,
    `font-src 'self'`,
    `connect-src ${IS_DEV ? "'self' ws: wss:" : "'self'"}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://accounts.google.com`,
    `frame-ancestors 'none'`,
    // Upgrade http subresources to https in prod only — on http://localhost it
    // just gets in the way.
    ...(IS_DEV ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  // Forward the nonce (x-nonce) and the CSP to the render pass. Next reads the
  // nonce out of the request Content-Security-Policy header to stamp its scripts;
  // the layout reads x-nonce for our own inline theme script.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    csp,
  );
  return response;
}

export const config = {
  matcher: [
    // Every route except static assets and the analytics/error proxies (no HTML,
    // no scripts, nothing to nonce). Skip prefetches so they stay cacheable.
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|ingest|monitoring).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
