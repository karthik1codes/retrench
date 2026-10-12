"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TRIGGERS = [
  {
    id: "funding",
    label: "Funding",
    title: "Series A–B raises",
    body: "Fresh capital usually means new budget owners and a mandate to expand GTM.",
    tags: ["Chat", "Evidence", "High priority"],
  },
  {
    id: "hiring",
    label: "Hiring",
    title: "Headcount surges",
    body: "Fast growth often precedes vendor evaluations in ops and revenue teams.",
    tags: ["Ops", "30d growth", "Medium"],
  },
  {
    id: "exec",
    label: "Exec moves",
    title: "Leadership changes",
    body: "New CROs and VPs reset vendor shortlists — reach them while the mandate is open.",
    tags: ["Leadership", "Window", "High"],
  },
] as const;

const PERKS = [
  "Cold starts under a cycle",
  "Private company graph",
  "Neo4j + CrustData",
  "Inbox-safe drafts",
  "Pinned evidence",
  "Your own mail client",
] as const;

export function LandingCatalog() {
  return (
    <section id="catalog" className="border-t border-white/5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm text-muted-foreground">Trigger catalog</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            Every open signal,
            <br />
            ready to draft
          </h2>
          <p className="mt-4 text-muted-foreground">
            Pick from funding, hiring, and exec moves — or bring your own watchlist
            domain. Each one runs through the same scout API.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/scout">Browse companies</ButtonLink>
            <ButtonLink href="/watchlist" variant="outline">
              Open watchlist
            </ButtonLink>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {PERKS.map((perk) => (
            <Badge key={perk} variant="secondary">
              {perk}
            </Badge>
          ))}
        </div>

        <Tabs defaultValue="funding" className="mt-12 gap-6">
          <TabsList className="mx-auto">
            {TRIGGERS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {TRIGGERS.map((t) => (
            <TabsContent key={t.id} value={t.id}>
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-card">
                <div className="border-b border-white/5 px-5 py-4 sm:px-6">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {t.title}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    {t.body}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid gap-0 md:grid-cols-2">
                  <div className="border-b border-white/5 p-5 md:border-b-0 md:border-e md:p-6">
                    <p className="text-xs text-muted-foreground">You</p>
                    <p className="mt-2 text-sm">
                      Which accounts need a person today?
                    </p>
                  </div>
                  <div className="p-5 md:p-6">
                    <p className="text-xs text-muted-foreground">
                      Signal Scout
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted-foreground">
                      <li>· Read open signals this week</li>
                      <li>· Checked funding stage and industry</li>
                      <li>· Drafted an inbox-safe note for review</li>
                    </ul>
                    <div className="mt-4 overflow-x-auto rounded-xl border border-white/8">
                      <table className="w-full min-w-[320px] text-left text-xs">
                        <thead className="bg-muted/40 text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2 font-medium">Company</th>
                            <th className="px-3 py-2 font-medium">Issue</th>
                            <th className="px-3 py-2 font-medium">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-white/5">
                            <td className="px-3 py-2">Multiply Labs</td>
                            <td className="px-3 py-2">Series B window</td>
                            <td className="px-3 py-2">High</td>
                          </tr>
                          <tr className="border-t border-white/5">
                            <td className="px-3 py-2">Vitalize</td>
                            <td className="px-3 py-2">New draft</td>
                            <td className="px-3 py-2">Medium</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
