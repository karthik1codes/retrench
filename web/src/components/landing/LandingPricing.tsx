"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Plan = {
  id: string;
  name: string;
  blurb: string;
  monthly: string;
  annual: string;
  cta: string;
  href: string;
  perks: string[];
  save?: boolean;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    id: "hobby",
    name: "Hobby",
    blurb: "For side projects and trying scout.",
    monthly: "Free",
    annual: "Free",
    cta: "Start for free",
    href: "/login",
    perks: [
      "$5 in free credits each month",
      "Company scout",
      "Weekly draft companies",
      "Community support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For teams that ship their first GTM loop.",
    monthly: "$39",
    annual: "$31",
    save: true,
    cta: "Start a 14-day trial",
    href: "/login",
    featured: true,
    perks: [
      "$25 in monthly credits",
      "Every trigger type",
      "HITL logging",
      "Contact resolve",
      "All industries",
    ],
  },
  {
    id: "dedicated",
    name: "Dedicated",
    blurb: "For steady outbound that needs fixed capacity.",
    monthly: "$199",
    annual: "$159",
    save: true,
    cta: "Reserve capacity",
    href: "/login",
    perks: [
      "Reserved scout cycles",
      "No soft rate limits",
      "Private company graph",
      "Priority support",
      "$500 credits included",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "For large teams with security needs.",
    monthly: "Custom",
    annual: "Custom",
    cta: "Talk to sales",
    href: "/login",
    perks: [
      "SSO and audit logs",
      "Private regions",
      "Named support engineer",
      "Custom terms",
      "99.99% uptime target",
    ],
  },
];

export function LandingPricing() {
  const [billing, setBilling] = useState("annual");

  return (
    <section id="pricing" className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">Pricing</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            Start free, pay for the scouts you run
          </h2>
          <p className="mt-4 text-muted-foreground">
            Credits for useful drafts — not idle infrastructure.
          </p>
        </div>

        <Tabs
          value={billing}
          onValueChange={(v) => {
            if (v) setBilling(String(v));
          }}
          className="mt-8 items-center"
        >
          <TabsList>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="annual">Annual · Save 20%</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const price =
              billing === "annual" ? plan.annual : plan.monthly;
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-5",
                  plan.featured
                    ? "border-primary/50 shadow-[0_0_0_1px_oklch(0.55_0.22_25_/_0.25)]"
                    : "border-white/10",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold tracking-tight">{plan.name}</h3>
                  {plan.save && billing === "annual" ? (
                    <Badge>Save 20%</Badge>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {plan.blurb}
                </p>
                <p className="mt-5 text-3xl font-semibold tracking-tight">
                  {price}
                  {price.startsWith("$") ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      /mo
                    </span>
                  ) : null}
                </p>
                <ButtonLink
                  href={plan.href}
                  variant={plan.featured ? "default" : "outline"}
                  className="mt-5"
                >
                  {plan.cta}
                </ButtonLink>
                <ul className="mt-5 flex flex-col gap-2">
                  {plan.perks.map((perk) => (
                    <li
                      key={perk}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
