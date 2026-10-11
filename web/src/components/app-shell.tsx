import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export function AppShell({
  children,
  showMail = true,
}: {
  children: React.ReactNode;
  showMail?: boolean;
}) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-background">
      <SiteHeader showMail={showMail} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
