"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth-button";
import { ButtonLink } from "@/components/ui/button-link";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/scout", label: "Scout" },
  { href: "/watchlist", label: "Watchlist" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-[color-mix(in_srgb,var(--canvas)_88%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="font-[family-name:var(--font-display)] text-[13px] font-bold tracking-[0.2em] text-primary"
          >
            SIGNAL SCOUT
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <AuthButton />
          <ButtonLink href="/scout" size="sm" className="hidden sm:inline-flex">
            New scout
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}
