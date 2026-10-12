"use client";

import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
} from "@/components/ui/field";

export function LoginForm({
  className,
  googleConfigured = true,
  authError,
  ...props
}: React.ComponentProps<"div"> & {
  googleConfigured?: boolean;
  authError?: string | null;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to scout companies and open drafts from your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {!googleConfigured ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-left text-sm text-destructive">
                <p className="font-medium">Sign-in is not configured</p>
                <p className="mt-2 text-destructive/90">
                  Ask your admin to finish auth setup, then try again.
                </p>
              </div>
            ) : null}
            {authError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                Sign-in failed. Please try again.
              </div>
            ) : null}
            <Field>
              <Button
                variant="outline"
                type="button"
                className="w-full"
                disabled={!googleConfigured}
                onClick={() => void signIn("google", { callbackUrl: "/scout" })}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                </svg>
                Continue with Google
              </Button>
            </Field>
            <FieldDescription className="text-center text-xs">
              If Google says the app is testing, add your email as a test user
              first —{" "}
              <a
                href="/settings/google"
                className="text-primary underline-offset-4 hover:underline"
              >
                Google OAuth setup
              </a>
              .
            </FieldDescription>
          </FieldGroup>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        Outreach goes out only from your mailbox.
      </FieldDescription>
    </div>
  );
}
