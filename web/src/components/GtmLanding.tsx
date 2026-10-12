"use client";

import { LandingCatalog } from "@/components/landing/LandingCatalog";
import { LandingCta } from "@/components/landing/LandingCta";
import { LandingDevelopers } from "@/components/landing/LandingDevelopers";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingNetwork } from "@/components/landing/LandingNetwork";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingWorkflow } from "@/components/landing/LandingWorkflow";

const LOGOS = [
  "OpenAI",
  "Granola",
  "Character AI",
  "Hello Patient",
  "Portola",
  "Oracle",
] as const;

/**
 * Marketing home — layout mirrors the Aceternity Inference landing pattern
 * (hero dashboard, features, workflow, network, developers, catalog, pricing)
 * adapted for Signal Scout. Official Aceternity registry requires a paid token.
 * @see https://ui.aceternity.com/page-preview/inference-landing-page
 */
export function GtmLanding() {
  return (
    <div className="gtm-canvas min-h-[100svh] text-foreground">
      <LandingNav />
      <main>
        <LandingHero />

        <section className="border-y border-white/5 py-10">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <p className="text-center text-xs text-muted-foreground">
              Serving production outreach for teams at
            </p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
              {LOGOS.map((name) => (
                <li
                  key={name}
                  className="text-sm font-medium tracking-tight text-muted-foreground/80"
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <LandingFeatures />
        <LandingWorkflow />
        <LandingNetwork />
        <LandingDevelopers />
        <LandingCatalog />
        <LandingPricing />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
