import Link from "next/link";
import { DeleteAccountButton } from "@/components/account/delete-account-button";
import { ExportAccountButton } from "@/components/account/export-account-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

// Account settings (§14): data export + hard account deletion. Server component —
// the (app) layout already gated the session; requireUser resolves the identity
// the two controls act on (both actions re-check the session server-side).
export default async function AccountPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-6 sm:py-8">
      <header className="space-y-1">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:underline">
          ← Back to dashboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Account</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium">{user.email}</span>
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Export your data</CardTitle>
          <CardDescription>
            Download everything Coursecal stores for you — your semesters, courses, and
            deliverables — as a JSON file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportAccountButton />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account and all of your data, including the Google Calendar
            events Coursecal created. This can&apos;t be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteAccountButton email={user.email} />
        </CardContent>
      </Card>
    </main>
  );
}
