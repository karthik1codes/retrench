import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, googleConfigured } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { SignalScoutLogo } from "@/components/SignalScoutLogo";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/scout");

  const params = await searchParams;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 self-center font-medium"
        >
          <SignalScoutLogo
            className="size-6 rounded-md"
            iconClassName="size-3.5"
          />
          <span className="font-heading tracking-wide">Signal Scout</span>
        </Link>
        <LoginForm
          googleConfigured={googleConfigured}
          authError={params.error ?? null}
        />
      </div>
    </div>
  );
}
