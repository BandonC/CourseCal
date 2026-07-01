import { CalendarCheckIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { GoogleIcon } from "@/components/icons/google";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth";
import { getOptionalUser } from "@/lib/auth/session";

// Public sign-in landing — the entry point to the (app) gate. signIn() runs as a
// server action (the v5 pattern); already-authed visitors skip straight in.
export default async function LoginPage() {
  if (await getOptionalUser()) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <CalendarCheckIcon className="size-6" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Coursecal</h1>
          <p className="text-sm text-muted-foreground">
            Turn your syllabi into a calendar.
          </p>
        </div>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-md">
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/dashboard" });
          }}
        >
          <Button type="submit" size="lg" className="h-11 w-full gap-2">
            <GoogleIcon className="size-4" />
            Continue with Google
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Sign in to create your account. No password required.
        </p>
      </div>
    </main>
  );
}
