import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { SectionCards } from "@/components/section-cards";
import { SignalsTable } from "@/components/signals-table";
import { fetchOverview } from "@/lib/overview";

export const metadata = {
  title: "Overview",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const overview = await fetchOverview();

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        {overview.error ? (
          <p className="px-4 text-sm text-muted-foreground lg:px-6">
            {overview.error}
          </p>
        ) : null}
        <SectionCards stats={overview.stats} error={overview.error} />
        <div className="px-4 lg:px-6">
          <ChartAreaInteractive activity={overview.activity} />
        </div>
        <div className="px-4 lg:px-6">
          <h2 className="mb-3 text-base font-medium">Live signals</h2>
        </div>
        <SignalsTable signals={overview.signals} error={overview.error} />
      </div>
    </div>
  );
}
