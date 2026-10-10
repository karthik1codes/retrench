import { notFound } from "next/navigation";
import { InvestigateView } from "@/components/investigate-view";
import { decideKeepFixKill, investigate, listFeatures } from "@/lib/retrench";

export const dynamic = "force-dynamic";

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ features }, brief] = await Promise.all([
    listFeatures(),
    investigate(id),
  ]);
  if (!brief) notFound();
  return (
    <InvestigateView
      brief={{ ...brief, decision: decideKeepFixKill(brief) }}
      portfolio={features}
    />
  );
}
