import { Badge } from "@/components/ui/badge";
import type { FeatureStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const styles: Record<FeatureStatus, string> = {
  healthy: "bg-emerald-600 text-white hover:bg-emerald-600",
  watch: "bg-amber-500 text-white hover:bg-amber-500",
  regress: "bg-red-600 text-white hover:bg-red-600",
  investigating: "bg-violet-600 text-white hover:bg-violet-600",
  fixing: "bg-sky-600 text-white hover:bg-sky-600",
  verifying: "bg-teal-600 text-white hover:bg-teal-600",
  paused: "bg-zinc-500 text-white hover:bg-zinc-500",
};

export function StatusBadge({ status }: { status: FeatureStatus }) {
  return (
    <Badge className={cn("rounded-md capitalize", styles[status])}>
      {status}
    </Badge>
  );
}
