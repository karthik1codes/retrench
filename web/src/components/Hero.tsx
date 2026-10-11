"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ButtonLink } from "@/components/ui/button-link";

gsap.registerPlugin(useGSAP);

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-brand", { y: 24, opacity: 0, duration: 0.65 })
        .from(".hero-line", { y: 28, opacity: 0, duration: 0.7 }, "-=0.35")
        .from(".hero-sub", { y: 16, opacity: 0, duration: 0.5 }, "-=0.4")
        .from(".hero-cta", { y: 12, opacity: 0, duration: 0.45 }, "-=0.28")
        .from(
          ".radar-ring",
          { scale: 0.75, opacity: 0, stagger: 0.1, duration: 0.85 },
          "-=0.7",
        );
      gsap.to(".radar-ring", {
        scale: 1.05,
        opacity: 0.4,
        duration: 2.6,
        stagger: 0.3,
        yoyo: true,
        repeat: -1,
        ease: "sine.inOut",
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="radar-field relative min-h-[100svh] overflow-hidden"
    >
      <div className="radar-grid absolute inset-0" aria-hidden />
      <div className="topo-lines absolute inset-0" aria-hidden />

      <div
        className="pointer-events-none absolute inset-y-[10%] right-[-6%] hidden w-[min(52vw,560px)] items-center justify-center md:flex"
        aria-hidden
      >
        <div className="radar-ring absolute h-[36%] w-[36%] rounded-full border border-primary/30" />
        <div className="radar-ring absolute h-[56%] w-[56%] rounded-full border border-primary/22" />
        <div className="radar-ring absolute h-[76%] w-[76%] rounded-full border border-primary/15" />
        <div className="absolute size-3 rounded-full bg-accent shadow-[0_0_0_10px_rgba(200,240,60,0.22)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col px-4 pb-14 pt-6 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <p className="hero-brand font-[family-name:var(--font-display)] text-[13px] font-bold tracking-[0.2em] text-primary">
            SIGNAL SCOUT
          </p>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <ButtonLink href="/watchlist" variant="ghost" size="sm">
              Watchlist
            </ButtonLink>
            <ButtonLink href="/scout" size="sm">
              Scout
            </ButtonLink>
          </div>
        </div>

        <div className="mt-auto max-w-xl pb-[10vh] pt-28 md:max-w-2xl">
          <h1 className="hero-brand font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[0.95] tracking-tight text-primary md:text-7xl">
            Signal Scout
          </h1>
          <p className="hero-line mt-6 font-[family-name:var(--font-display)] text-2xl font-semibold leading-snug tracking-tight text-foreground md:text-3xl">
            Reach out only when something real happened this week.
          </p>
          <p className="hero-sub mt-4 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
            Funding, hiring surges, and exec moves — drafted from evidence. You
            choose the contact and send.
          </p>
          <div className="hero-cta mt-9 flex flex-wrap items-center gap-3">
            <ButtonLink href="/scout" size="lg" className="px-5">
              Scout a company
            </ButtonLink>
            <ButtonLink href="/watchlist" variant="outline" size="lg" className="px-5">
              This week&apos;s watchlist
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
