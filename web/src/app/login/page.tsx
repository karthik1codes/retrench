import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/scout");

  return (
    <div className="radar-field flex min-h-[100svh] items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
