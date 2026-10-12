"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ButtonLink } from "@/components/ui/button-link";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#network", label: "Signals" },
  { href: "#developers", label: "Developers" },
  { href: "#catalog", label: "Triggers" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function LandingNav() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <SignalScoutLogo className="size-8 rounded-lg ring-1 ring-white/10" />
          <span className="text-sm font-semibold tracking-tight">
            Signal Scout
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {session?.user ? (
            <ButtonLink href="/scout" size="sm">
              Open scout
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink href="/login" size="sm" className="hidden sm:inline-flex">
                Talk to sales
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
