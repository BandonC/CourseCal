import { redirect } from "next/navigation";
import { SignInBento } from "@/components/landing/sign-in-bento";
import { getOptionalUser } from "@/lib/auth/session";

// Public home (COURSECAL.md §3.1 step 1): the shared sign-in screen. Authed
// visitors skip straight to their dashboard.
export default async function RootPage() {
  if (await getOptionalUser()) redirect("/dashboard");

  return <SignInBento />;
}
