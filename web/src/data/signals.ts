export type SignalItem = {
  id: string;
  severity: number;
  company: string;
  domain: string;
  summary: string;
  why: string;
  draft?: {
    subject: string;
    body: string;
    confidence: number;
  };
};

export const SEGMENT =
  "Series A–B fintech SaaS, 20–200 employees, US";

export const DEMO_SIGNALS: SignalItem[] = [
  {
    id: "gallatin",
    severity: 85,
    company: "Gallatin AI, Inc.",
    domain: "gallatin.ai",
    summary:
      "Gallatin AI, Inc. raised $50,000,000 series_a (announced 2026-10-08)",
    why: "Fresh Series A capital usually means new budget owners and a mandate to expand product or GTM.",
    draft: {
      subject: "Exciting Opportunities with Gallatin AI",
      body: `Hi,

Congratulations on raising $50,000,000 in your Series A funding announced on 2026-10-08. This investment reflects strong confidence and a window to expand product and market presence.

Worth a short conversation on how we support teams in that phase?

Best`,
      confidence: 88,
    },
  },
  {
    id: "arena",
    severity: 85,
    company: "Arena",
    domain: "arena.ai",
    summary: "Arena raised $200,000,000 series_b (announced 2026-10-08)",
    why: "Series B scale-ups often add sales tooling while headcount and pipeline ramp.",
    draft: {
      subject: "Partnership Opportunity with Arena",
      body: `Hi,

I noticed Arena raised $200,000,000 in Series B funding, announced on 2026-10-08. That capital typically funds scaling motions where partnership timing matters.

Open to a brief sync on fit?

Best`,
      confidence: 88,
    },
  },
  {
    id: "wally",
    severity: 70,
    company: "Wally Health",
    domain: "carebywally.com",
    summary: "Wally Health headcount +10.0% in 30 days",
    why: "Fast headcount growth often precedes new vendor evaluations in ops and GTM.",
    draft: {
      subject: "Supporting Your Rapid Growth at Wally Health",
      body: `Hi,

Wally Health’s headcount is up 10.0% in 30 days — usually a moment teams shore up process and tooling.

Happy to share how peers handled the same ramp.

Best`,
      confidence: 88,
    },
  },
  {
    id: "namespace",
    severity: 85,
    company: "Namespace",
    domain: "namespace.so",
    summary:
      "Namespace raised $42,000,000 series_b (announced 2026-10-05)",
    why: "Recent Series B is a clean trigger for outbound that cites a real event.",
    draft: {
      subject: "Supporting Namespace's Growth Journey",
      body: `Hi,

Congratulations on the $42,000,000 Series B announced on 2026-10-05. As you scale, teams like yours often revisit outbound and enablement stack.

Worth connecting this week?

Best`,
      confidence: 88,
    },
  },
  {
    id: "healthleap",
    severity: 85,
    company: "HealthLeap AI",
    domain: "healthleap.ai",
    summary:
      "HealthLeap AI raised $8,000,000 series_a (announced 2026-10-07)",
    why: "Early Series A buyers are still forming the stack — drafts stay evidence-bound.",
  },
];
