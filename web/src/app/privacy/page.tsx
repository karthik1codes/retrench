import Link from "next/link";
import type { Metadata } from "next";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Signal Scout uses Google account and Gmail data.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="mb-8 inline-flex items-center gap-2.5">
        <SignalScoutLogo className="size-8 rounded-lg" />
        <span className="text-sm font-semibold">Signal Scout</span>
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated {new Date().toISOString().slice(0, 10)} · For Google OAuth /
        Gmail API consent.
      </p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">Overview</h2>
          <p>
            Signal Scout helps you research company signals and draft outreach.
            When you sign in with Google, we request access only to send mail
            from your account (when you allow agent send) and to read your Sent
            folder to verify that a message was sent.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">
            Google user data we access
          </h2>
          <ul className="list-disc space-y-1 ps-5">
            <li>
              <strong className="text-foreground">Basic profile</strong> —
              name, email, and profile photo for sign-in.
            </li>
            <li>
              <strong className="text-foreground">gmail.send</strong> — only
              when you choose agent send and approve a draft (or overdue
              follow-up).
            </li>
            <li>
              <strong className="text-foreground">gmail.readonly</strong> —
              search your Sent mail to confirm delivery after you compose in
              Gmail. We do not read your full inbox for marketing.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">
            How we use that data
          </h2>
          <p>
            Tokens are stored in your Auth.js session/JWT on the app server to
            call Gmail on your behalf. Draft and send preferences may be stored
            in your browser (localStorage). We do not sell Google user data. We
            do not use Gmail content to train unrelated AI models.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">
            Data sharing & retention
          </h2>
          <p>
            Gmail content is not shared with third parties except Google (as
            the API provider) and infrastructure needed to run the app. You can
            revoke access anytime in{" "}
            <a
              className="text-primary underline-offset-4 hover:underline"
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
            >
              Google Account → Third-party access
            </a>
            . Signing out clears the app session.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-medium text-foreground">Contact</h2>
          <p>
            Questions about this policy: use the support email configured on
            the Google Cloud OAuth consent screen for this project.
          </p>
        </section>
      </div>

      <p className="mt-10 text-sm">
        <Link href="/terms" className="text-primary hover:underline">
          Terms
        </Link>
      </p>
    </main>
  );
}
