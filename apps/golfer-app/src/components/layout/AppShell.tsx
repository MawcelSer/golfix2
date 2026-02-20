import type { ReactNode } from "react";
import { BottomTabs } from "./BottomTabs";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-pine font-sans text-cream">
      <main className="flex flex-1 flex-col pb-14">{children}</main>
      <BottomTabs />
    </div>
  );
}
