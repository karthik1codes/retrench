import { Watchlist } from "@/components/Watchlist";
import { fetchLiveWatchlist } from "@/lib/overview";

export const metadata = {
  title: "Watchlist",
};

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const data = await fetchLiveWatchlist();

  return (
    <div className="flex flex-1 flex-col">
      {data.error ? (
        <p className="px-4 pt-4 text-sm text-muted-foreground sm:px-6">
          {data.error}
        </p>
      ) : null}
      <Watchlist signals={data.signals || []} />
    </div>
  );
}
