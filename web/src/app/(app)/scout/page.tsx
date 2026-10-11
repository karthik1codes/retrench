import { Suspense } from "react";
import { ScoutStudio } from "@/components/ScoutStudio";

export const metadata = {
  title: "Scout",
};

export default function ScoutPage() {
  return (
    <Suspense
      fallback={
        <div className="p-10 text-sm text-muted-foreground">Loading…</div>
      }
    >
      <ScoutStudio />
    </Suspense>
  );
}
