import type { ReactNode } from "react";

import { PwaInstallBanner } from "@/components/PwaInstallBanner";

type DoorAppShellProps = {
  children: ReactNode;
};

/** Full-viewport shell — prevents document scroll in iOS/Android standalone PWA. */
export function DoorAppShell({ children }: DoorAppShellProps) {
  return (
    <div className="door-app-shell flex size-full min-h-0 flex-col overflow-hidden">
      <PwaInstallBanner />
      <main className="min-h-0 flex-1 overflow-hidden">
        <div className="size-full min-h-0">{children}</div>
      </main>
    </div>
  );
}
