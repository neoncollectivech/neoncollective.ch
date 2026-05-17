import { Link, Outlet, useLocation } from "react-router-dom";

import { adminBasename } from "@/lib/admin-base";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/events", label: "Events" },
  { href: "/orders", label: "Orders" },
  { href: "/people", label: "People" },
];

export function AdminLayout() {
  const { pathname } = useLocation();
  const { data: session } = useSession();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border bg-card p-4 flex flex-col gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">NEON</p>
          <h1 className="text-lg font-semibold text-primary">Admin</h1>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                pathname.startsWith(`${adminBasename}${item.href}`)
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-2">
          <p className="text-xs text-muted-foreground truncate">{session?.user.email}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
