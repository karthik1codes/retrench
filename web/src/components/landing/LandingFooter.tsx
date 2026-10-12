"use client";

import Link from "next/link";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/scout", label: "Scout" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/sent", label: "Sent" },
      { href: "#features", label: "Pipeline" },
    ],
  },
  {
    title: "Stack",
    links: [
      { href: "https://crustdata.com", label: "CrustData", external: true },
      { href: "https://neatlogs.com", label: "neatlogs", external: true },
      { href: "https://entire.io", label: "Entire", external: true },
      { href: "https://cfo.ai", label: "cfo.ai", external: true },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/login", label: "Sign in" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 pb-10 pt-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <SignalScoutLogo className="size-8 rounded-lg" />
              <span className="text-sm font-semibold">Signal Scout</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Trigger-event GTM agent — detect real signals this week, draft
              evidence-backed outreach, never auto-send.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-medium">{col.title}</p>
              <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-foreground">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>neatHack · CrustData · neatlogs · Entire · cfo.ai</p>
          <p>© {new Date().getFullYear()} Signal Scout</p>
        </div>
      </div>
    </footer>
  );
}
