"use client";

import Link from "next/link";
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const reduce = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduce) return;

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".hero-brand", { y: 28, opacity: 0, duration: 0.7 })
        .from(".hero-line", { y: 36, opacity: 0, duration: 0.75 }, "-=0.35")
        .from(".hero-sub", { y: 20, opacity: 0, duration: 0.55 }, "-=0.4")
        .from(".hero-cta", { y: 16, opacity: 0, duration: 0.5 }, "-=0.3")
        .from(
          ".radar-ring",
          { scale: 0.7, opacity: 0, stagger: 0.12, duration: 0.9 },
          "-=0.8",
        );

      gsap.to(".radar-ring", {
        scale: 1.06,
        opacity: 0.35,
        duration: 2.4,
        stagger: 0.35,
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
        className="pointer-events-none absolute inset-y-[12%] right-[-8%] flex w-[min(58vw,640px)] items-center justify-center max-md:opacity-40"
        aria-hidden
      >
        <div className="radar-ring absolute h-[38%] w-[38%] rounded-full border border-[rgba(11,58,44,0.35)]" />
        <div className="radar-ring absolute h-[58%] w-[58%] rounded-full border border-[rgba(11,58,44,0.28)]" />
        <div className="radar-ring absolute h-[78%] w-[78%] rounded-full border border-[rgba(11,58,44,0.2)]" />
        <div className="absolute h-3 w-3 rounded-full bg-[var(--signal)] shadow-[0_0_0_10px_rgba(200,240,60,0.25)]" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col px-6 pb-16 pt-8 md:px-10">
        <nav className="flex items-center justify-between gap-4">
          <span className="hero-brand font-[family-name:var(--font-display)] text-sm font-bold tracking-[0.18em] text-[var(--deep)]">
            SIGNAL SCOUT
          </span>
          <div className="flex items-center gap-4 text-sm font-medium text-[var(--ink-soft)]">
            <Link
              href="/scout"
              className="underline-offset-4 hover:text-[var(--ink)] hover:underline"
            >
              Scout a company
            </Link>
            <Link
              href="/watchlist"
              className="underline-offset-4 hover:text-[var(--ink)] hover:underline"
            >
              Watchlist
            </Link>
          </div>
        </nav>

        <div className="mt-auto max-w-xl pb-[12vh] pt-24 md:max-w-2xl">
          <p className="hero-brand mb-5 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-none tracking-tight text-[var(--deep)] md:text-6xl lg:text-7xl">
            Signal Scout
          </p>
          <h1 className="hero-line font-[family-name:var(--font-display)] text-2xl font-semibold leading-tight tracking-tight text-[var(--ink)] md:text-4xl">
            Only reach out when something real happened this week.
          </h1>
          <p className="hero-sub mt-5 max-w-md text-base leading-relaxed text-[var(--ink-soft)] md:text-lg">
            Trigger EC2 for any SaaS company, pull a cited draft, send from your
            own inbox when you&apos;re ready.
          </p>
          <div className="hero-cta mt-9 flex flex-wrap items-center gap-4">
            <Link
              href="/scout"
              className="inline-flex items-center bg-[var(--deep)] px-6 py-3.5 text-sm font-semibold tracking-wide text-[var(--signal)] transition hover:bg-[var(--ink)]"
            >
              Scout a company
            </Link>
            <Link
              href="/watchlist"
              className="text-sm font-medium text-[var(--ink-soft)] underline-offset-4 hover:underline"
            >
              See this week&apos;s watchlist
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
