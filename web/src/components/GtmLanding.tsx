"use client";

import { LandingCta } from "@/components/landing/LandingCta";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingStack } from "@/components/landing/LandingStack";
import { LandingWorkflow } from "@/components/landing/LandingWorkflow";

/**
 * Marketing home for Signal Scout — product story only.
 * Stack partners: CrustData · neatlogs · Entire · cfo.ai
 */
export function GtmLanding() {
  return (
    <div className="gtm-canvas min-h-[100svh] text-foreground">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingStack />
        <LandingFeatures />
        <LandingWorkflow />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
