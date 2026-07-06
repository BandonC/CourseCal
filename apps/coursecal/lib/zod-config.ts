import { z } from "zod";

// Force Zod into interpreted (jitless) mode instead of its JIT path. The JIT
// probes eval availability with `Function("")`, which our strict CSP
// (script-src without 'unsafe-eval', see proxy.ts) blocks — Zod catches the
// failure and falls back to the exact interpreted path this sets, so behavior is
// unchanged. Setting it up front skips the probe entirely, which keeps the
// browser console free of a benign-but-perpetual CSP eval violation on every
// page that validates a schema. Imported from both instrumentation entry points
// so it runs once, before any `.parse()`, in every runtime (browser, node, edge).
z.config({ jitless: true });
