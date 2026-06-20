import { redirect } from "next/navigation";

// Root entry. The flow now lives under the authed (app) group; "/" sends users
// to the dashboard, which itself bounces to /login when there's no session.
// A real marketing landing replaces this in Phase 7.
export default function RootPage() {
  redirect("/dashboard");
}
