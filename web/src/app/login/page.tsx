import Link from "next/link";
import { redirect } from "next/navigation";
import { GalleryVerticalEndIcon } from "lucide-react";
import { auth, googleConfigured } from "@/auth";
import { LoginForm } from "@/components/login-form";

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
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GalleryVerticalEndIcon className="size-4" />
          </div>
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
