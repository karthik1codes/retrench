"use client";

const STACK = [
  {
    name: "CrustData",
    href: "https://crustdata.com",
    role: "Company & people signals",
  },
  {
    name: "neatlogs",
    href: "https://neatlogs.com",
    role: "Runtime traces & evals",
  },
  {
    name: "Entire",
    href: "https://entire.io",
    role: "Session ↔ commit checkpoints",
  },
  {
    name: "cfo.ai",
    href: "https://cfo.ai",
    role: "Unit economics & budget",
  },
] as const;

/** Sponsors / integrations used by Signal Scout — not fake customer logos. */
export function LandingStack() {
  return (
    <section
      id="stack"
      className="border-y border-white/5 py-10 sm:py-12"
      aria-label="Integrations"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-center text-xs text-muted-foreground">
          Built on the neatHack stack
        </p>
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
          {STACK.map((item) => (
            <li
              key={item.name}
              className="flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border border-white/8 bg-card/40 px-3 py-4 text-center"
            >
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium tracking-tight text-muted-foreground/90 transition hover:text-foreground"
              >
                {item.name}
              </a>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground/70">
                {item.role}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
