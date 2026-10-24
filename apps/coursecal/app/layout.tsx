import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Bricolage_Grotesque } from "next/font/google";
import { PostHogProvider } from "@/lib/analytics/posthog-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display typeface for headings (wired to --font-heading in globals.css @theme).
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Coursecal",
  description: "Turn course syllabi into a calendar and a navigable semester plan.",
};

// Set the theme class before first paint to avoid a flash: honor the `theme`
// cookie the toggle writes, falling back to the OS preference. Inlined in <head>
// so it runs before the body renders; the toggle (components/theme-toggle.tsx)
// keeps this cookie in sync.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]+)/);var t=m?m[1]:null;if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Nonce set by proxy.ts for the CSP. Reading it here opts every route into
  // dynamic rendering (intended — see proxy.ts). undefined only if a route
  // somehow bypasses middleware; the inline script below then has no nonce.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Browsers blank a script's nonce attribute after load (so injected code
            can't read it), which React flags as a hydration mismatch. The script
            already ran with the real nonce, so the warning is noise. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </head>
      <body className="flex min-h-full flex-col">
        <PostHogProvider>{children}</PostHogProvider>
        <Toaster />
      </body>
    </html>
  );
}
