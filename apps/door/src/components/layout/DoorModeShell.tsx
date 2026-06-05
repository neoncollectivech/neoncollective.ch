import type { ReactNode } from "react";

import { DoorModeNav } from "@/components/nav/DoorModeNav";

type DoorModeShellProps = {
  children: ReactNode;
};

export function DoorModeShell({ children }: DoorModeShellProps) {
  return (
    <div className="flex size-full min-h-0 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      <DoorModeNav />
    </div>
  );
}
