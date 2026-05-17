import { Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminAbsoluteUrl } from "@/lib/admin-base";
import { signIn, useSession } from "@/lib/auth-client";

export function LoginPage() {
  const { data: session, isPending } = useSession();

  if (!isPending && session) {
    return <Navigate to="/events" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>NEON Admin</CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign in with your <span className="text-foreground">@neonclub.ch</span> Google
            account.
          </p>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() =>
              signIn.social({
                provider: "google",
                callbackURL: adminAbsoluteUrl("events"),
              })
            }
          >
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
