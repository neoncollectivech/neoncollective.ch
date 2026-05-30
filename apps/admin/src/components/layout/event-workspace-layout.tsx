import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";

import { EventSwitcher } from "@/components/event-switcher";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import {
  eventWorkspaceNavHref,
  visibleEventWorkspaceNavItems,
} from "@/lib/event-workspace-nav";
import { rememberLastEventId } from "@/lib/event-workspace-paths";
import { cn } from "@/lib/utils";

export function EventWorkspaceLayout() {
  const { eventId, isValid } = useEventIdParam();
  const { pathname } = useLocation();
  const eventQuery = useQuery({
    ...adminApi.event.detail(eventId),
    enabled: isValid,
  });
  const event = eventQuery.data;

  useEffect(() => {
    if (isValid) {
      rememberLastEventId(eventId);
    }
  }, [eventId, isValid]);

  if (!isValid) {
    return <Navigate replace to="/events" />;
  }

  const navItems = event
    ? visibleEventWorkspaceNavItems({ accessMode: event.accessMode })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          className="text-sm text-muted-foreground hover:text-foreground"
          to="/events"
        >
          Events
        </Link>
        <span className="text-muted-foreground">›</span>
        <EventSwitcher
          currentEventId={eventId}
          currentStatus={event?.status}
          currentTitle={event?.title}
        />
      </div>

      {eventQuery.isLoading && (
        <p className="text-muted-foreground">Loading event…</p>
      )}

      <div className="flex gap-8">
        <aside className="w-44 shrink-0">
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const href = eventWorkspaceNavHref(eventId, item.section);
              const active =
                pathname === href || pathname.startsWith(`${href}/`);

              return (
                <Link
                  key={item.section}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                  to={href}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
