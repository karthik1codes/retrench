import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Retrench — Keep or kill AI features",
  description:
    "Unit-economics control plane for AI features. Runtime from neatlogs, change from entire.io, money from cfo.ai.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="group flex items-center gap-2.5">
              <span className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm transition duration-200 group-hover:scale-105">
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,oklch(1_0_0_/_0.25),transparent_55%)]" />
                <span className="relative">R</span>
              </span>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight">
                  Retrench
                </div>
                <div className="text-[11px] text-muted-foreground">
                  keep · fix · kill
                </div>
              </div>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Portfolio
              </Link>
              <Link
                href="/features/checkout-recovery"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Investigate
              </Link>
              <Link
                href="/agent"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Agent
              </Link>
              <Link
                href="/setup"
                className="rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Setup
              </Link>
              <a
                href="https://neatlogs.com"
                target="_blank"
                rel="noreferrer"
                className="hidden rounded-md px-3 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline"
              >
                neatlogs
              </a>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-card/60">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Retrench joins{" "}
              <span className="font-medium text-foreground">neatlogs</span> ·{" "}
              <span className="font-medium text-foreground">entire.io</span> ·{" "}
              <span className="font-medium text-foreground">cfo.ai</span>
            </p>
            <p>Runtime → change → money. Decide at the unit-economics line.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
