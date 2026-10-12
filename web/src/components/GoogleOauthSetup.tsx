"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";
import { cn } from "@/lib/utils";

const CONSOLE_CONSENT =
  "https://console.cloud.google.com/apis/credentials/consent";
const CONSOLE_CREDS = "https://console.cloud.google.com/apis/credentials";
const CONSOLE_GMAIL = "https://console.cloud.google.com/apis/library/gmail.googleapis.com";
const TEST_USERS_HELP =
  "https://support.google.com/cloud/answer/10311615";

type StepId =
  | "project"
  | "logo"
  | "consent"
  | "testers"
  | "scopes"
  | "redirect"
  | "signin";

const STEPS: { id: StepId; title: string; body: string }[] = [
  {
    id: "project",
    title: "1. Open OAuth consent screen",
    body: "Google Cloud → APIs & Services → OAuth consent screen. User type: External. App name: Signal Scout.",
  },
  {
    id: "logo",
    title: "2. Upload app logo",
    body: "Upload the Signal Scout mark (square JPG below). Google recommends ~120×120 px.",
  },
  {
    id: "consent",
    title: "3. App links",
    body: "Homepage, privacy, and terms must be public HTTPS URLs (or localhost for local testing). Paste the links from this page.",
  },
  {
    id: "testers",
    title: "4. Add test users",
    body: "While Publishing status is Testing, only listed emails can sign in — that is the message you saw.",
  },
  {
    id: "scopes",
    title: "5. Scopes + Gmail API",
    body: "Enable Gmail API. Add .../auth/gmail.readonly and .../auth/gmail.send. These are sensitive/restricted — keep Testing until you submit verification.",
  },
  {
    id: "redirect",
    title: "6. OAuth client redirect",
    body: "Create Web application credentials. Add the callback URI from AUTH_URL.",
  },
  {
    id: "signin",
    title: "7. Re-consent",
    body: "Sign out of Signal Scout, then sign in again so Google shows the new logo and scopes.",
  },
];

export function GoogleOauthSetup() {
  const { data: session } = useSession();
  const [done, setDone] = useState<Record<StepId, boolean>>(() => {
    if (typeof window === "undefined") {
      return Object.fromEntries(STEPS.map((s) => [s.id, false])) as Record<
        StepId,
        boolean
      >;
    }
    try {
      const raw = window.localStorage.getItem("signal-scout:google-oauth-setup");
      return raw
        ? { ...Object.fromEntries(STEPS.map((s) => [s.id, false])), ...JSON.parse(raw) }
        : Object.fromEntries(STEPS.map((s) => [s.id, false]));
    } catch {
      return Object.fromEntries(STEPS.map((s) => [s.id, false])) as Record<
        StepId,
        boolean
      >;
    }
  });
  const [testerEmail, setTesterEmail] = useState(session?.user?.email || "");

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const links = useMemo(
    () => ({
      home: origin,
      privacy: `${origin}/privacy`,
      terms: `${origin}/terms`,
      callback: `${origin}/api/auth/callback/google`,
      logo: `${origin}/brand/signal-scout-oauth-logo.jpg`,
      logoSvg: `${origin}/brand/signal-scout-mark.svg`,
    }),
    [origin],
  );

  function toggle(id: StepId) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      window.localStorage.setItem(
        "signal-scout:google-oauth-setup",
        JSON.stringify(next),
      );
      return next;
    });
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Could not copy");
    }
  }

  const completed = STEPS.filter((s) => done[s.id]).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        <SignalScoutLogo className="size-10 rounded-xl" iconClassName="size-5" />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            Google verification setup
          </h1>
          <p className="text-sm text-muted-foreground">
            That “app has not completed Google verification” screen means the
            OAuth app is in <strong>Testing</strong>. Add yourself as a tester
            (and upload the logo) — full public verification is optional later.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {completed}/{STEPS.length} steps
            </Badge>
            {session?.gmailConnected ? (
              <Badge>Gmail connected</Badge>
            ) : (
              <Badge variant="outline">Gmail not connected yet</Badge>
            )}
          </div>
        </div>
      </div>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b py-3">
          <CardTitle>App logo for Google Console</CardTitle>
          <CardDescription>
            Download or open these files, then upload under OAuth consent screen
            → App logo.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <Image
            src="/brand/signal-scout-oauth-logo.jpg"
            alt="Signal Scout OAuth logo"
            width={120}
            height={120}
            className="rounded-2xl ring-1 ring-border"
            unoptimized
          />
          <div className="flex flex-col gap-2">
            <a
              href="/brand/signal-scout-oauth-logo.jpg"
              download="signal-scout-oauth-logo.jpg"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Download JPG (OAuth upload)
            </a>
            <a
              href="/brand/signal-scout-mark.svg"
              download="signal-scout-mark.svg"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            >
              Download SVG mark
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void copy(links.logo, "logo URL")}
            >
              Copy public logo URL
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b py-3">
          <CardTitle>URLs to paste in consent screen</CardTitle>
          <CardDescription>
            Use your deployed HTTPS origin for production testers. Localhost is
            fine for developer testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          {(
            [
              ["Application home page", links.home],
              ["Privacy policy", links.privacy],
              ["Terms of service", links.terms],
              ["Authorized redirect URI", links.callback],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground">{label}</Label>
              <div className="flex gap-2">
                <Input readOnly value={value} className="font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => void copy(value, label)}
                >
                  Copy
                </Button>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Authorized domains: your production host only (no protocol), e.g.{" "}
            <code className="text-foreground">your-app.vercel.app</code>. Add{" "}
            <code className="text-foreground">localhost</code> is not required
            as a domain for local redirects.
          </p>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b py-3">
          <CardTitle>Add a test user (fixes the warning)</CardTitle>
          <CardDescription>
            Audience → Test users → Add users. Use the exact Google account that
            signs into Signal Scout.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tester">Tester Gmail</Label>
            <div className="flex gap-2">
              <Input
                id="tester"
                type="email"
                value={testerEmail}
                onChange={(e) => setTesterEmail(e.target.value)}
                placeholder="you@gmail.com"
              />
              <Button
                size="sm"
                variant="outline"
                className="shrink-0"
                disabled={!testerEmail.trim()}
                onClick={() => void copy(testerEmail.trim(), "tester email")}
              >
                Copy email
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={CONSOLE_CONSENT}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm" }))}
            >
              Open consent screen
            </a>
            <a
              href={TEST_USERS_HELP}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "secondary" }))}
            >
              Test users help
            </a>
          </div>
          <p className="text-xs text-muted-foreground">
            After adding the email, wait a minute, then sign out and sign in
            again. You should no longer be blocked by “contact the developer.”
          </p>
        </CardContent>
      </Card>

      <Card size="sm" className="shadow-none">
        <CardHeader className="border-b py-3">
          <CardTitle>Checklist</CardTitle>
          <CardDescription>
            Click each row when finished. Progress is saved in this browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 py-3">
          {STEPS.map((step) => (
            <button
              key={step.id}
              type="button"
              onClick={() => toggle(step.id)}
              className={`rounded-lg border px-3 py-2.5 text-left transition ${
                done[step.id]
                  ? "border-primary/40 bg-accent/20"
                  : "border-border hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{step.title}</p>
                <Badge variant={done[step.id] ? "default" : "outline"}>
                  {done[step.id] ? "Done" : "Todo"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{step.body}</p>
            </button>
          ))}
          <Separator className="my-2" />
          <div className="flex flex-wrap gap-2">
            <a
              href={CONSOLE_GMAIL}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            >
              Enable Gmail API
            </a>
            <a
              href={CONSOLE_CREDS}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
            >
              OAuth credentials
            </a>
            <Link
              href="/privacy"
              className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
            >
              Privacy page
            </Link>
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
            >
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>

      <p className="pb-6 text-xs text-muted-foreground">
        Publishing to Production with Gmail send/readonly requires Google app
        verification (and often a security assessment). For hackathon / private
        testers, stay on <strong>Testing</strong> and keep the tester list
        updated.
      </p>
    </div>
  );
}
