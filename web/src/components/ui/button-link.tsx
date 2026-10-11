import Link from "next/link";
import type { ComponentProps } from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type Props = ComponentProps<typeof Link> &
  VariantProps<typeof buttonVariants> & {
    className?: string;
  };

/** Styled Next.js Link using button variants — avoids Base UI nativeButton warnings. */
export function ButtonLink({
  className,
  variant = "default",
  size = "default",
  ...props
}: Props) {
  return (
    <Link
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
