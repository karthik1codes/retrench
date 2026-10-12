import type { Metadata } from "next";
import { GoogleOauthSetup } from "@/components/GoogleOauthSetup";

export const metadata: Metadata = {
  title: "Google OAuth setup",
  description:
    "Upload the Signal Scout logo, add OAuth test users, and finish Google consent screen setup.",
};

export default function GoogleSettingsPage() {
  return (
    <div className="min-h-svh bg-background">
      <GoogleOauthSetup />
    </div>
  );
}
