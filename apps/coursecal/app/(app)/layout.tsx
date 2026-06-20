import { requireUser } from "@/lib/auth/session";

// Gate for every authed route under (app). requireUser() redirects to /login
// when there is no session — this is the enforcement boundary for the whole
// group (middleware is not relied on as the sole guarantee; CLAUDE.md). App
// chrome (nav, etc.) lands in Phase 7 polish.
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}
