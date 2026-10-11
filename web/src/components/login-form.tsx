"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function LoginForm() {
  return (
    <Card className="w-full max-w-md shadow-none">
      <CardHeader className="space-y-3 text-center">
        <p className="font-[family-name:var(--font-display)] text-[12px] font-bold tracking-[0.2em] text-primary">
          SIGNAL SCOUT
        </p>
        <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
          Sign in to continue
        </CardTitle>
        <CardDescription className="text-balance">
          Use your Google account. Drafts open in your Gmail — no app passwords.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          className="w-full"
          size="lg"
          onClick={() => void signIn("google", { callbackUrl: "/scout" })}
        >
          Continue with Google
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to send outreach only under your own mailbox.
        </p>
        <div className="text-center">
          <ButtonLink href="/" variant="ghost" size="sm">
            Back to home
          </ButtonLink>
        </div>
      </CardContent>
    </Card>
  );
}
