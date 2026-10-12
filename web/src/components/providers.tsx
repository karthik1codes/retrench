"use client";

import { SessionProvider } from "next-auth/react";
import { UserProfileSync } from "@/components/UserProfileSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus>
      <UserProfileSync />
      {children}
    </SessionProvider>
  );
}
