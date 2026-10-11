"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import type { ActivityPoint } from "@/lib/overview";
import { useIsMobile } from "@/hooks/use-mobile";

const chartConfig = {
  signals: {
    label: "Signals",
    color: "var(--primary)",
  },
  drafts: {
    label: "Drafts",
    color: "var(--muted-foreground)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive({
  activity,
}: {
  activity: ActivityPoint[];
}) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d");
  }, [isMobile]);

  const filteredData = React.useMemo(() => {
    if (!activity.length) return [];
    const sorted = [...activity].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1]?.date;
    if (!last) return sorted;
    const end = new Date(last);
    let days = 90;
    if (timeRange === "30d") days = 30;
    if (timeRange === "7d") days = 7;
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return sorted.filter((row) => new Date(row.date) >= start);
  }, [activity, timeRange]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Scout activity</CardTitle>
        <CardDescription>
          {activity.length
            ? "Signals and drafts from your live graph"
            : "No activity yet — run a scout cycle"}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={(value) => setTimeRange(value[0] ?? "90d")}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={(value) => {
              if (value !== null) setTimeRange(value);
            }}
          >
            <SelectTrigger
              className="flex w-40 @[767px]/card:hidden"
              size="sm"
              aria-label="Select range"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d">Last 3 months</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {filteredData.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No scout activity in this range
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillSignals" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-signals)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-signals)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillDrafts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-drafts)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-drafts)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="drafts"
                type="natural"
                fill="url(#fillDrafts)"
                stroke="var(--color-drafts)"
                stackId="a"
              />
              <Area
                dataKey="signals"
                type="natural"
                fill="url(#fillSignals)"
                stroke="var(--color-signals)"
                stackId="a"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
