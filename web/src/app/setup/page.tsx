import Link from "next/link";
import { ArrowRight, Check, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSetupReport } from "@/lib/integrations";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const setup = await getSetupReport();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="space-y-3">
        <Badge
          className={cn(
            "rounded-md",
            setup.mock
              ? "bg-amber-600 text-white hover:bg-amber-600"
              : "bg-emerald-700 text-white hover:bg-emerald-700"
          )}
        >
          {setup.mock ? "demo mode" : "live / hybrid"}
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Integration setup
        </h1>
        <p className="text-muted-foreground">
          Retrench needs neatlogs (runtime), entire.io (change), and cfo.ai
          (money). Fill the gaps below, then walk{" "}
          <Link href="/" className="font-medium text-foreground underline-offset-4 hover:underline">
            Portfolio → Investigate → Keep/Fix/Kill
          </Link>
          .
        </p>
      </div>

      <div className="grid gap-3">
        {setup.integrations.map((item) => (
          <Card key={item.id} className="shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">{item.label}</CardTitle>
                <CardDescription className="mt-1">{item.detail}</CardDescription>
              </div>
              {item.ok ? (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
                  <Check className="size-4" />
                </span>
              ) : (
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
                  <CircleAlert className="size-4" />
                </span>
              )}
            </CardHeader>
            {item.nextStep ? (
              <CardContent className="text-sm text-muted-foreground">
                Next: {item.nextStep}
              </CardContent>
            ) : null}
          </Card>
        ))}
      </div>

      <Card className="border-dashed shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Checklist to leave demo mode</CardTitle>
          <CardDescription>
            Edit <code className="font-mono text-xs">web/.env.local</code> (never
            commit secrets).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Keep <code className="font-mono text-xs">NEATLOGS_API_KEY</code>{" "}
              for agent ingest (traces already show in app.neatlogs.com).
            </li>
            <li>
              Add <code className="font-mono text-xs">NEATLOGS_TOKEN</code> from
              Settings → Service Accounts (
              <code className="font-mono text-xs">observability:read</code>) —
              ingest keys cannot call{" "}
              <code className="font-mono text-xs">GET /api/v1/public/traces</code>
              .
            </li>
            <li>
              Run <code className="font-mono text-xs">entire enable --agent cursor</code>{" "}
              (or keep the seeded <code className="font-mono text-xs">.entire/</code>{" "}
              checkpoint for demos).
            </li>
            <li>
              Optional: <code className="font-mono text-xs">CFO_AI_ACCESS_TOKEN</code>{" "}
              for Ari MCP; unit-economics still run locally without it.
            </li>
            <li>
              Set <code className="font-mono text-xs">USE_MOCK_DATA=false</code> and
              restart <code className="font-mono text-xs">npm run dev</code>.
            </li>
            <li>
              Deploy with <code className="font-mono text-xs">infra/ec2-bootstrap.sh</code>{" "}
              + ALB health on <code className="font-mono text-xs">/api/health</code>.
            </li>
          </ol>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/"
          className={cn(buttonVariants(), "inline-flex gap-1.5")}
        >
          Open portfolio
          <ArrowRight className="size-3.5" />
        </Link>
        <Link
          href="/features/checkout-recovery"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Investigate Checkout Recovery
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        Checked {new Date(setup.checkedAt).toLocaleString("en-US")} · ready for
        live enrichments: {setup.readyForLive ? "yes" : "not yet"}
      </p>
    </div>
  );
}
