import { ReconnectButton } from "@/components/reconnect/reconnect-button";
import { signIn } from "@/lib/auth";
import { requireUser } from "@/lib/auth/session";

// Recovery for revoked/expired Calendar consent (ADR-008). Normal sign-in never
// forces consent; this route does, via per-call authorization params — the v5
// mechanism (verified against next-auth 5.0.0-beta.31). prompt=consent makes
// Google re-issue a refresh token, which the jwt callback re-encrypts and stores.
export default async function ReconnectPage() {
  await requireUser();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-md space-y-1 text-center">
        <h1 className="text-2xl font-semibold">Reconnect Google Calendar</h1>
        <p className="text-muted-foreground text-sm">
          Your Google Calendar access expired or was revoked. Reconnect to let Coursecal
          add your deliverables to your calendar again.
        </p>
      </div>
      <form
        action={async () => {
          "use server";
          await signIn(
            "google",
            { redirectTo: "/dashboard" },
            { prompt: "consent", access_type: "offline" },
          );
        }}
      >
        <ReconnectButton />
      </form>
    </main>
  );
}
