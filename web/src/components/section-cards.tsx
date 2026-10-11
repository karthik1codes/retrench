"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { OverviewStats } from "@/lib/overview";
import { TrendingUpIcon } from "lucide-react";

export function SectionCards({
  stats,
  error,
}: {
  stats: OverviewStats;
  error?: string;
}) {
  const lastRunLabel = stats.last_run_at
    ? new Date(stats.last_run_at).toLocaleString()
    : "No runs yet";

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Live signals</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.signals}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Graph</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Active triggers <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            {error ? "Agent unreachable" : "From your scout graph"}
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Drafts ready</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.drafts_ready}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Review</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="font-medium">Waiting for you to send</div>
          <div className="text-muted-foreground">Never auto-sent</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Companies</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.companies}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">Tracked</Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="font-medium">In the watch graph</div>
          <div className="text-muted-foreground">Unique domains / accounts</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Last scout run</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats.last_run_status || "—"}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {(stats.last_run_credits ?? 0).toFixed(2)} cr
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="font-medium truncate max-w-full">{lastRunLabel}</div>
          <div className="text-muted-foreground truncate max-w-full">
            {stats.last_run_id || "Run a scout to populate"}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
