import { Navigate, Outlet } from "react-router-dom";

import { DoorModeShell } from "@/components/layout/DoorModeShell";
import { getDoorSessionConfig } from "@/lib/storage/session-config";

export function AuthGuard() {
  const session = getDoorSessionConfig();

  if (!session) {
    return <Navigate replace to="/setup" />;
  }

  return (
    <DoorModeShell>
      <Outlet />
    </DoorModeShell>
  );
}
