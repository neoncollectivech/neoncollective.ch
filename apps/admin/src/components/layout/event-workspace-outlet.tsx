import { Navigate, Outlet } from "react-router-dom";

import { useEventIdParam } from "@/hooks/use-event-id-param";

export function EventWorkspaceOutlet() {
  const { isValid } = useEventIdParam();

  if (!isValid) {
    return <Navigate replace to="/events" />;
  }

  return <Outlet />;
}
