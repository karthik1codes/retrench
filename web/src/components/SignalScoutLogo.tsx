import Image from "next/image";
import { cn } from "@/lib/utils";

type SignalScoutLogoProps = {
  className?: string;
  iconClassName?: string;
  /** When true, only the mark (no wordmark). */
  markOnly?: boolean;
};

/** Shared Signal Scout brand mark — red dish + signal arcs. */
export function SignalScoutLogo({
  className,
  iconClassName: _iconClassName,
  markOnly = true,
}: SignalScoutLogoProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-lg",
        "size-8",
        className,
      )}
      role="img"
      aria-label="Signal Scout"
    >
      <Image
        src="/brand/signal-scout-mark.svg"
        alt=""
        width={512}
        height={512}
        className="size-full object-cover"
        unoptimized
        priority
      />
      {!markOnly ? (
        <span className="sr-only">Signal Scout</span>
      ) : null}
    </span>
  );
}
