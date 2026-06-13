// Runs once when a server instance boots. Importing the env module here forces
// the Zod validation to run at startup so misconfiguration fails fast, before
// any request is served (COURSECAL.md §9.5). Guarded to the Node runtime — the
// env module is server-only and not edge-compatible.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./lib/env");
  }
}
