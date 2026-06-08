import { Navigate, Outlet } from "react-router-dom";

import { getDoorSessionConfig } from "@/lib/storage/session-config";

export function AuthGuard() {
  const session = getDoorSessionConfig();

  if (!session) {
    return <Navigate replace to="/setup" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}
