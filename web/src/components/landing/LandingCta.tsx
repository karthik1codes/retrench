"use client";

import { ArrowRightIcon } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export function LandingCta() {
  return (
    <section className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(135deg,oklch(0.22_0.06_25),oklch(0.12_0.01_260)_55%,oklch(0.1_0.005_260))] px-6 py-16 text-center sm:px-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")",
            }}
            aria-hidden
          />
          <div className="relative mx-auto max-w-2xl">
            <p className="text-sm font-medium text-primary">Signal Scout</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
              Ready to scout
              <br />
              your first company?
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/scout" size="lg" className="px-6">
                Scout a company
                <ArrowRightIcon data-icon="inline-end" />
              </ButtonLink>
              <ButtonLink href="/login" variant="outline" size="lg" className="px-6">
                Read the docs
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
