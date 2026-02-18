import type { ReactNode } from "react";
import { BottomTabs } from "./BottomTabs";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-pine text-cream">
      <main className="flex-1 pb-14">{children}</main>
      <BottomTabs />
    </div>
  );
}
