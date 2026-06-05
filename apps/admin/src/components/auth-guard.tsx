import { Navigate } from "react-router-dom";

import { isAdminAuthDisabled } from "@/lib/admin-auth-dev";
import { useSession } from "@/lib/auth-client";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const devBypass = isAdminAuthDisabled();
  const { data: session, isPending } = useSession();

  if (devBypass) {
    return children;
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate replace to="/login" />;
  }

  return children;
}
