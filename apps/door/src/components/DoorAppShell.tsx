import type { ReactNode } from "react";

import { useLocation } from "react-router-dom";

import { PwaInstallBanner } from "@/components/PwaInstallBanner";
import { DoorModeNav } from "@/components/nav/DoorModeNav";
import { isDoorAuthenticatedRoute } from "@/lib/door-routes";
import { cn } from "@/lib/utils";

type DoorAppShellProps = {
  children: ReactNode;
};

/** Full-viewport shell — prevents document scroll in iOS/Android standalone PWA. */
export function DoorAppShell({ children }: DoorAppShellProps) {
  const { pathname } = useLocation();
  const showModeNav = isDoorAuthenticatedRoute(pathname);

  return (
    <div className="door-app-shell flex size-full min-h-0 flex-1 flex-col overflow-hidden">
      <PwaInstallBanner />
      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden",
          showModeNav &&
            "pb-[calc(3.25rem+max(0.5rem,env(safe-area-inset-bottom)))]",
        )}
      >
        {children}
      </main>
      {showModeNav ? <DoorModeNav /> : null}
    </div>
  );
}
