import { Suspense } from "react";
import { ScoutStudio } from "@/components/ScoutStudio";

export const metadata = {
  title: "Scout",
};

export default function ScoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <ScoutStudio />
      </div>
    </Suspense>
  );
}
