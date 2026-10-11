"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";

export function AuthButton() {
  const { data, status } = useSession();

  if (status === "loading") {
    return (
      <Button variant="outline" size="sm" disabled>
        …
      </Button>
    );
  }

  if (!data?.user) {
    return (
      <Button size="sm" onClick={() => void signIn("google", { callbackUrl: "/scout" })}>
        Sign in
      </Button>
    );
  }

  const label = data.user.email || data.user.name || "Account";

  return (
    <div className="flex items-center gap-2">
      <div className="hidden max-w-[160px] truncate text-right text-xs text-muted-foreground sm:block">
        {label}
      </div>
      {data.user.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.user.image}
          alt=""
          className="size-7 rounded-full border border-border"
        />
      ) : null}
      <Button
        variant="outline"
        size="sm"
        onClick={() => void signOut({ callbackUrl: "/" })}
      >
        Sign out
      </Button>
    </div>
  );
}

export function AuthGateHint() {
  const { data, status } = useSession();
  if (status === "loading" || data?.user) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
      Sign in to open drafts from your mailbox.{" "}
      <ButtonLink href="/login" variant="link" size="sm" className="h-auto px-0">
        Sign in
      </ButtonLink>
    </div>
  );
}
