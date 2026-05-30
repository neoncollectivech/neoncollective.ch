import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

type AdminSidebarFooterProps = {
  email?: string | null;
};

export function AdminSidebarFooter({ email }: AdminSidebarFooterProps) {
  return (
    <div className="mt-auto space-y-2">
      <p className="text-xs text-muted-foreground truncate">{email}</p>
      <Button
        className="w-full"
        size="sm"
        variant="outline"
        onClick={() => signOut()}
      >
        Sign out
      </Button>
    </div>
  );
}
