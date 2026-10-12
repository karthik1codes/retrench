"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SNIPPET = `import { scout } from "@signalscout/sdk"

const run = await scout.company({
  domain: "multiplylabs.com",
  token: process.env.SCOUT_API_TOKEN,
})

console.log(run.matched_company.name)
console.log(run.drafts[0]?.body)`;

const CAPS = [
  {
    title: "Scout API",
    body: "HTTP agent on :8787 — company in, drafts and context out.",
  },
  {
    title: "Evidence hashes",
    body: "Every draft can cite the signal graph behind the ask.",
  },
  {
    title: "HITL actions",
    body: "Approve, edit, reject — logged without auto-send.",
  },
  {
    title: "Targets feed",
    body: "Weekly draft companies grouped by industry for the UI.",
  },
  {
    title: "Tracing",
    body: "Credits and run ids for each scout cycle.",
    badge: "New",
  },
] as const;

export function LandingDevelopers() {
  return (
    <section id="developers" className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">Developers</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Change one URL.
            <br />
            Keep the GTM flow you have.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Signal Scout speaks a simple scout agent API, so the Next app and
            your scripts work without rewriting outreach.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/scout">Open scout</ButtonLink>
            <ButtonLink href="/login" variant="outline">
              Get an API token
            </ButtonLink>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {CAPS.map((cap) => (
            <Badge key={cap.title} variant="outline" className="gap-1.5 px-3 py-1">
              {cap.title}
              {"badge" in cap && cap.badge ? (
                <span className="text-primary">{cap.badge}</span>
              ) : null}
            </Badge>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <Tabs defaultValue="js" className="overflow-hidden rounded-2xl border border-white/10 bg-card">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
              <TabsList className="h-8">
                <TabsTrigger value="js">scout.ts</TabsTrigger>
                <TabsTrigger value="env">.env</TabsTrigger>
              </TabsList>
              <span className="text-xs text-muted-foreground">Run</span>
            </div>
            <TabsContent value="js" className="m-0">
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <code>{SNIPPET}</code>
              </pre>
            </TabsContent>
            <TabsContent value="env" className="m-0">
              <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted-foreground sm:text-sm">
                <code>{`SCOUT_AGENT_URL=http://ec2-host:8787
SCOUT_API_TOKEN=••••••••
NEXTAUTH_URL=http://localhost:3000`}</code>
              </pre>
            </TabsContent>
            <div className="flex flex-wrap gap-3 border-t border-white/5 px-4 py-2 text-[11px] text-muted-foreground">
              <span>Node 20</span>
              <span>UTF-8</span>
              <span>agent :8787</span>
            </div>
          </Tabs>

          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-card p-5">
            <p className="text-xs text-muted-foreground">Response · Streaming</p>
            <div className="rounded-xl border border-white/8 bg-background/50 p-4 text-sm leading-relaxed">
              Multiply Labs · series_b · Robotics Engineering
              <br />
              <span className="text-muted-foreground">
                Draft ready with funding trigger cited. Open Gmail when you
                approve.
              </span>
            </div>
            <div className="mt-auto grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border border-white/8 p-3">
                <p className="text-[11px] text-muted-foreground">First draft</p>
                <p className="mt-1 font-semibold tabular-nums">84 ms</p>
              </div>
              <div className="rounded-xl border border-white/8 p-3">
                <p className="text-[11px] text-muted-foreground">Confidence</p>
                <p className="mt-1 font-semibold tabular-nums">88</p>
              </div>
              <div className="rounded-xl border border-white/8 p-3">
                <p className="text-[11px] text-muted-foreground">Credits</p>
                <p className="mt-1 font-semibold tabular-nums">2</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
