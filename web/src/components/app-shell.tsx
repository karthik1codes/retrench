/** Marketing shell — app pages use the dashboard-01 sidebar layout instead. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100svh] flex-col bg-background">{children}</div>
  );
}
