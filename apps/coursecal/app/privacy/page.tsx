import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// Public privacy policy (no auth gate) — required for Google OAuth verification of
// the sensitive calendar.events scope, and linked from the landing/login footer.
// Content tracks the app's actual data practices; update it when those change.

export const metadata: Metadata = {
  title: "Privacy Policy · Coursecal",
  description: "How Coursecal collects, uses, and protects your data.",
};

const CONTACT_EMAIL = "brandonjchong@gmail.com";
const LAST_UPDATED = "July 10, 2026";

export default function PrivacyPage() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="w-fit">
            <Wordmark />
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:py-16">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="mt-10 space-y-10">
          <section className="space-y-3">
            <p className="leading-relaxed text-muted-foreground">
              Coursecal turns your course syllabi into a calendar and a semester timeline.
              This policy explains what we collect, how we use it, and the choices you have.
              It applies to the Coursecal app at{" "}
              <span className="text-foreground">coursecal.bandonc.com</span>.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Information we collect</h2>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Google account info.</span> When
                you sign in with Google, we receive your email address, name, and profile
                picture. We use this to identify your account.
              </li>
              <li>
                <span className="font-medium text-foreground">Google Calendar access.</span> With
                your permission (the <code>calendar.events</code> scope), we create, update, and
                delete calendar events for the deadlines in your courses. We only touch events
                Coursecal creates; we do not read your existing calendar.
              </li>
              <li>
                <span className="font-medium text-foreground">Syllabus content.</span> The
                syllabus text you paste, or that we extract from a PDF or DOCX, so we can find
                your assignments, quizzes, and exams. Files are read{" "}
                <span className="text-foreground">in your browser</span> — the file itself is
                never uploaded, only the extracted text.
              </li>
              <li>
                <span className="font-medium text-foreground">Data you create.</span> The
                semesters, courses, and deliverables you save, and the IDs of the calendar events
                we create for you.
              </li>
              <li>
                <span className="font-medium text-foreground">Usage &amp; error data.</span>{" "}
                Aggregate, non-identifying product analytics and error reports to keep the app
                working. These exclude your email, name, and syllabus content.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">How we use your information</h2>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>To sign you in and keep you signed in.</li>
              <li>To parse your syllabi into a structured list of deadlines.</li>
              <li>To create and keep your Google Calendar events in sync with those deadlines.</li>
              <li>To show your semester as a timeline with heavy weeks and deadline clusters flagged.</li>
            </ul>
            <p className="leading-relaxed text-muted-foreground">
              We do not sell your data, and we do not use it for advertising.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              How syllabus content is processed
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              To find deadlines, your syllabus text is sent to Anthropic&apos;s Claude API and
              treated strictly as data to extract from — not as instructions. Anthropic does not
              use content submitted through its API to train its models. We keep only the
              structured result (course and deliverable details); we retain the original syllabus
              text so you can re-parse or review a course, and you can delete it at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              Google user data and Limited Use
            </h2>
            <p className="leading-relaxed text-muted-foreground">
              Coursecal&apos;s use and transfer of information received from Google APIs adheres to
              the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. We use Google user data only to provide and
              improve the calendar features you request, never for advertising, and never sold to
              third parties. Human access to this data occurs only with your consent, for security
              or legal reasons, or on de-identified data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Service providers</h2>
            <p className="leading-relaxed text-muted-foreground">
              We share data only with the providers needed to run Coursecal, each under their own
              terms:
            </p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Google</span> — sign-in and Calendar.
              </li>
              <li>
                <span className="font-medium text-foreground">Anthropic</span> — parsing syllabus
                text (as above).
              </li>
              <li>
                <span className="font-medium text-foreground">Neon</span> — the database that
                stores your account and course data.
              </li>
              <li>
                <span className="font-medium text-foreground">Vercel</span> — application hosting.
              </li>
              <li>
                <span className="font-medium text-foreground">PostHog and Sentry</span> —
                non-identifying analytics and error monitoring.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Data retention and deletion</h2>
            <p className="leading-relaxed text-muted-foreground">
              We keep your data until you delete it. From your account settings you can{" "}
              <span className="text-foreground">export all your data</span> as a file, or{" "}
              <span className="text-foreground">delete your account</span>, which permanently
              removes your account and all associated semesters, courses, deliverables, and stored
              tokens, and removes the calendar events Coursecal created where possible.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Security</h2>
            <p className="leading-relaxed text-muted-foreground">
              Your Google refresh token is encrypted at rest (AES-256-GCM), all traffic is served
              over HTTPS, and every request for your data is scoped to your account. No system is
              perfectly secure, but we take reasonable measures to protect your information.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Your choices</h2>
            <p className="leading-relaxed text-muted-foreground">
              You can revoke Coursecal&apos;s access to your Google account at any time from your{" "}
              <a
                href="https://myaccount.google.com/permissions"
                className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Account permissions
              </a>
              , and you can delete your Coursecal account and data from the app at any time.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Changes to this policy</h2>
            <p className="leading-relaxed text-muted-foreground">
              If we make material changes, we&apos;ll update the &ldquo;Last updated&rdquo; date
              above. Continued use of Coursecal after a change means you accept the revised policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Contact</h2>
            <p className="leading-relaxed text-muted-foreground">
              Questions about this policy or your data? Email{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              >
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
