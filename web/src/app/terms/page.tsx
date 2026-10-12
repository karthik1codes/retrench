import Link from "next/link";
import type { Metadata } from "next";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using Signal Scout during testing and production.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
        <SignalScoutLogo className="size-8 rounded-lg" />
        <span className="text-sm font-semibold">Signal Scout</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated {new Date().toISOString().slice(0, 10)}
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p>
          Signal Scout is provided as-is for outreach research and drafting.
          While the Google OAuth app is in{" "}
          <strong className="text-foreground">Testing</strong> mode, only
          Google accounts listed as test users can sign in.
        </p>
        <p>
          You are responsible for messages you approve or send. Do not use the
          product to spam, harass, or violate applicable email and privacy laws.
          Gmail send happens only with your explicit permission (human-in-the-loop
          or agent-approved mode).
        </p>
        <p>
          See the{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>{" "}
          for how Google / Gmail data is handled.
        </p>
      </div>
    </main>
  );
}
