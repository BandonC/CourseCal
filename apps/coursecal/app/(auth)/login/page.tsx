import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import { getOptionalUser } from "@/lib/auth/session";

// Public sign-in landing — the entry point to the (app) gate. signIn() runs as a
// server action (the v5 pattern); already-authed visitors skip straight in.
// Marketing copy and visual polish are Phase 7.
export default async function LoginPage() {
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">Coursecal</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Turn your syllabi into a calendar.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <Button type="submit" size="lg">
          Sign in with Google
        </Button>
      </form>
    </main>
  );
}
