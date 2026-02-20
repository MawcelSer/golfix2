import type { ReactNode } from "react";
import { BottomTabs } from "./BottomTabs";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-pine font-sans text-cream">
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-14">{children}</main>
      <BottomTabs />
    </div>
  );
}
