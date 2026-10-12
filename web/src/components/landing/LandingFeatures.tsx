"use client";

import { useState } from "react";
import {
  CableIcon,
  MapPinIcon,
  RadarIcon,
  WalletIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "detect",
    label: "Detect signals",
    title: "From push to first draft",
    icon: RadarIcon,
    steps: [
      { label: "Match company", time: "2s" },
      { label: "Pull profile", time: "8s" },
      { label: "Score triggers", time: "6s" },
      { label: "Write draft", time: "4s" },
    ],
    cards: [
      {
        title: "Scout any domain",
        body: "Type a company. Scout resolves the profile and recent signals from your graph.",
      },
      {
        title: "Scale with traffic",
        body: "Weekly draft companies refresh on a timer — idle cycles stay quiet.",
      },
      {
        title: "Route to the right angle",
        body: "Funding, hiring, and exec moves pick the draft that fits the moment.",
      },
      {
        title: "Pay for usefulness",
        body: "Credits track scouts and drafts. You still send from your own inbox.",
      },
    ],
  },
  {
    id: "draft",
    label: "Draft outreach",
    title: "Evidence before you send",
    icon: CableIcon,
    steps: [
      { label: "Cite trigger", time: "1s" },
      { label: "Inbox-safe copy", time: "3s" },
      { label: "HITL approve", time: "—" },
      { label: "Open mail", time: "1s" },
    ],
    cards: [
      {
        title: "Trigger-backed subject",
        body: "Short, specific lines that reference what just happened — no spam words.",
      },
      {
        title: "Cited evidence",
        body: "Hashes and summaries stay with the draft so you can trust the why.",
      },
      {
        title: "Human approval",
        body: "Approve, edit, or reject. Scout logs HITL — it never auto-sends.",
      },
      {
        title: "Your mailbox",
        body: "Open Gmail, Outlook, or the mail app with the draft already filled.",
      },
    ],
  },
  {
    id: "route",
    label: "Find contacts",
    title: "Nearest decision-maker",
    icon: MapPinIcon,
    steps: [
      { label: "Resolve domain", time: "1s" },
      { label: "Rank roles", time: "4s" },
      { label: "Business email", time: "3s" },
      { label: "Select recipient", time: "—" },
    ],
    cards: [
      {
        title: "Role-aware lookup",
        body: "Prefer revenue and ops owners when the trigger is GTM-shaped.",
      },
      {
        title: "Business emails only",
        body: "Skip personal inboxes when a company address is available.",
      },
      {
        title: "One click to compose",
        body: "Recipient, subject, and body land in the client you already use.",
      },
      {
        title: "Do-not-contact guard",
        body: "Recent outreach and support-risk accounts stay suppressed.",
      },
    ],
  },
  {
    id: "credits",
    label: "Credits",
    title: "Spend only on scouts you run",
    icon: WalletIcon,
    steps: [
      { label: "Start free", time: "0$" },
      { label: "Scout company", time: "1 cr" },
      { label: "Draft ready", time: "1 cr" },
      { label: "You send", time: "0$" },
    ],
    cards: [
      {
        title: "Transparent spend",
        body: "Each scout surfaces credits used so you can keep a hard budget.",
      },
      {
        title: "No idle GPUs metaphor",
        body: "Cycles run on a timer. Between runs, nothing burns quietly.",
      },
      {
        title: "Team-ready later",
        body: "Same scout surface scales from solo GTM to a shared watchlist.",
      },
      {
        title: "You own the send",
        body: "Mail stays in your account — Scout is context, not a spam cannon.",
      },
    ],
  },
] as const;

export function LandingFeatures() {
  const [tab, setTab] = useState(TABS[0].id);
  const active = TABS.find((t) => t.id === tab) || TABS[0];

  return (
    <section id="features" className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">Pipeline</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Everything between the trigger and your send
          </h2>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (v) setTab(String(v));
          }}
          className="mt-12 gap-8"
        >
          <TabsList className="mx-auto flex h-auto w-full max-w-2xl flex-wrap justify-center gap-1 bg-muted/60 p-1">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.id} value={t.id} className="mt-0">
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-2xl border border-white/10 bg-card p-5 sm:p-6">
                  <div className="flex items-center gap-2">
                    <t.icon className="size-4 text-primary" />
                    <Badge variant="secondary">Live</Badge>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold tracking-tight">
                    {t.title}
                  </h3>
                  <ol className="mt-6 flex flex-col gap-3">
                    {t.steps.map((step, i) => (
                      <li
                        key={step.label}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-background/40 px-3 py-2.5"
                      >
                        <span className="flex items-center gap-3 text-sm">
                          <span className="flex size-6 items-center justify-center rounded-md bg-primary/15 font-mono text-[11px] text-primary">
                            {i + 1}
                          </span>
                          {step.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {step.time}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {t.cards.map((card, i) => (
                    <div
                      key={card.title}
                      className={cn(
                        "rounded-2xl border border-white/10 bg-card p-5",
                        i === 0 && "sm:col-span-2",
                      )}
                    >
                      <h4 className="font-semibold tracking-tight">
                        {card.title}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {card.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <p className="sr-only">{active.label}</p>
      </div>
    </section>
  );
}
