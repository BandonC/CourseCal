// Auth.js v5 route handler — exposes /api/auth/* (OAuth callback, session, etc.).
// All config lives in lib/auth; this only re-exports the generated handlers.
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
