import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button-link";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/scout");

  return (
    <div className="radar-field flex min-h-[100svh] items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-none">
        <CardHeader className="space-y-3 text-center">
          <p className="font-[family-name:var(--font-display)] text-[12px] font-bold tracking-[0.2em] text-primary">
            SIGNAL SCOUT
          </p>
          <CardTitle className="font-[family-name:var(--font-display)] text-2xl">
            Sign in to continue
          </CardTitle>
          <CardDescription className="text-balance">
            Use your Google account. Drafts open in your Gmail — we never ask for
            an app password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/scout" });
            }}
          >
            <Button type="submit" className="w-full" size="lg">
              Continue with Google
            </Button>
          </form>
          <p className="text-center text-xs text-muted-foreground">
            By continuing you agree to send outreach only under your own
            mailbox.
          </p>
          <div className="text-center">
            <ButtonLink href="/" variant="ghost" size="sm">
              Back to home
            </ButtonLink>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
