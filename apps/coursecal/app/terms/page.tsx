import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/wordmark";

// Public terms of service (no auth gate) — linked from the landing/login footer and
// referenced on the OAuth consent screen. The accuracy disclaimer and liability
// limit matter most here: parsing is automated and can be wrong, so users must
// verify deadlines themselves. Update when the service or practices change.

export const metadata: Metadata = {
  title: "Terms of Service · Coursecal",
  description: "The terms for using Coursecal.",
};

const CONTACT_EMAIL = "brandonjchong@gmail.com";
const LAST_UPDATED = "July 10, 2026";

export default function TermsPage() {
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
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="mt-10 space-y-10">
          <section className="space-y-3">
            <p className="leading-relaxed text-muted-foreground">
              These Terms govern your use of Coursecal at{" "}
              <span className="text-foreground">coursecal.bandonc.com</span> (&ldquo;Coursecal,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;). By signing in or using the app, you agree to these
              Terms. If you don&apos;t agree, don&apos;t use Coursecal.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">What Coursecal is</h2>
            <p className="leading-relaxed text-muted-foreground">
              Coursecal reads course syllabi you provide, extracts assignment, quiz, and exam
              deadlines, and helps you add them to your Google Calendar and view them on a semester
              timeline. It is a personal planning aid, not an official source of your course
              requirements.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Your account</h2>
            <p className="leading-relaxed text-muted-foreground">
              You sign in with a Google account and are responsible for activity under your account.
              You must be old enough to form a binding contract and to use a Google account in your
              jurisdiction. Keep your Google credentials secure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Accuracy and your responsibility</h2>
            <p className="leading-relaxed text-muted-foreground">
              Coursecal extracts deadlines automatically, including with AI, and{" "}
              <span className="text-foreground">it can make mistakes</span> — misreading a date, a
              weight, or an assignment, or missing one entirely. You are responsible for reviewing
              what Coursecal produces and for verifying every deadline against your official syllabus
              and your instructor&apos;s announcements. Coursecal is not responsible for missed
              deadlines, grades, or any academic consequences arising from reliance on it.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Acceptable use</h2>
            <p className="leading-relaxed text-muted-foreground">You agree not to:</p>
            <ul className="list-disc space-y-2 pl-5 leading-relaxed text-muted-foreground">
              <li>Use Coursecal for anything unlawful or to upload content you don&apos;t have the right to use.</li>
              <li>Attempt to disrupt, overload, reverse-engineer, or gain unauthorized access to the service or its systems.</li>
              <li>Use the service to build a competing product by scraping or bulk-extracting it.</li>
              <li>Misuse another person&apos;s account or data.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Your content</h2>
            <p className="leading-relaxed text-muted-foreground">
              You keep ownership of the syllabus text and other content you provide. You grant
              Coursecal permission to process that content solely to provide the service — parsing it
              into deadlines and creating your calendar events. How we handle this data is described
              in our{" "}
              <Link
                href="/privacy"
                className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Third-party services</h2>
            <p className="leading-relaxed text-muted-foreground">
              Coursecal relies on third parties, including Google (sign-in and Calendar). Your use of
              those services is also governed by their own terms — for example, Google&apos;s Terms of
              Service. We are not responsible for third-party services.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Availability and changes</h2>
            <p className="leading-relaxed text-muted-foreground">
              Coursecal is offered as-is and may change, be interrupted, or be discontinued at any
              time without notice. We don&apos;t guarantee any level of availability or that the
              service will be error-free.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Disclaimer of warranties</h2>
            <p className="leading-relaxed text-muted-foreground">
              To the fullest extent permitted by law, Coursecal is provided &ldquo;as is&rdquo; and
              &ldquo;as available,&rdquo; without warranties of any kind, whether express or implied,
              including fitness for a particular purpose, accuracy, and non-infringement.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Limitation of liability</h2>
            <p className="leading-relaxed text-muted-foreground">
              To the fullest extent permitted by law, Coursecal and its operator will not be liable
              for any indirect, incidental, or consequential damages, or for any lost grades, missed
              deadlines, or academic outcomes, arising from your use of or inability to use the
              service. Coursecal is a free planning aid, and you use it at your own risk.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Termination</h2>
            <p className="leading-relaxed text-muted-foreground">
              You may stop using Coursecal and delete your account at any time from the app. We may
              suspend or end your access if you violate these Terms or misuse the service. On
              deletion, your data is removed as described in the Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Changes to these Terms</h2>
            <p className="leading-relaxed text-muted-foreground">
              We may update these Terms from time to time. If we make material changes, we&apos;ll
              update the &ldquo;Last updated&rdquo; date above. Continuing to use Coursecal after a
              change means you accept the revised Terms.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Governing law</h2>
            <p className="leading-relaxed text-muted-foreground">
              These Terms are governed by the laws of the jurisdiction in which Coursecal&apos;s
              operator resides, without regard to conflict-of-law rules, and you agree to the
              exclusive jurisdiction of the courts there for any dispute.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">Contact</h2>
            <p className="leading-relaxed text-muted-foreground">
              Questions about these Terms? Email{" "}
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
