import { Navigate, Outlet, useLocation } from "react-router-dom";

import { DoorModeShell } from "@/components/layout/DoorModeShell";
import { getDoorSessionConfig } from "@/lib/storage/session-config";

export function AuthGuard() {
  const session = getDoorSessionConfig();
  const { pathname } = useLocation();

  if (!session) {
    return <Navigate replace to="/setup" />;
  }

  const usesOwnShell = pathname.startsWith("/pos");

  if (usesOwnShell) {
    return <Outlet />;
  }

  return (
    <DoorModeShell>
      <Outlet />
    </DoorModeShell>
  );
}
