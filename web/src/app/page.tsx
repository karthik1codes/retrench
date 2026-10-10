import { FeaturePortfolio } from "@/components/feature-portfolio";
import { listFeatures } from "@/lib/retrench";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const { features, sources } = await listFeatures();
  return <FeaturePortfolio features={features} sources={sources} />;
}
