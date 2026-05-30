import type { AdminNavLink } from "@/hooks/use-admin-sidebar-model";

import { Link, useLocation } from "react-router-dom";

import { cn } from "@/lib/utils";

type AdminNavListProps = {
  links: AdminNavLink[];
};

export function AdminNavList({ links }: AdminNavListProps) {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((item) => {
        const active = item.isActive(pathname);

        return (
          <Link
            key={item.key}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            to={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
