import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { adminApi } from "@/hooks/use-admin-api";
import {
  eventWorkspaceNavHref,
  visibleEventWorkspaceNavItems,
} from "@/lib/event-workspace-nav";
import {
  parseEventWorkspaceEventId,
  rememberLastEventId,
} from "@/lib/event-workspace-paths";

export type AdminNavLink = {
  key: string;
  label: string;
  href: string;
  isActive: (pathname: string) => boolean;
};

export type AdminSidebarModel = {
  mode: "global" | "event";
  eventId?: string;
  back?: { label: string; href: string };
  links: AdminNavLink[];
  eventTitle?: string;
  isEventLoading?: boolean;
};

const GLOBAL_LINKS: Omit<AdminNavLink, "isActive">[] = [
  { key: "events", label: "Events", href: "/events" },
  { key: "people", label: "People", href: "/people" },
  { key: "maintenance", label: "Maintenance", href: "/maintenance" },
];

function buildGlobalLinks(): AdminNavLink[] {
  return GLOBAL_LINKS.map((item) => ({
    ...item,
    isActive: (pathname) => {
      if (item.key === "events") {
        return pathname === "/events" || pathname === "/events/new";
      }

      return pathname === item.href || pathname.startsWith(`${item.href}/`);
    },
  }));
}

function workspaceLinkIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function useAdminSidebarModel(): AdminSidebarModel {
  const { pathname } = useLocation();
  const eventId = parseEventWorkspaceEventId(pathname);

  const eventQuery = useQuery({
    ...adminApi.event.detail(eventId ?? ""),
    enabled: Boolean(eventId),
  });

  useEffect(() => {
    if (eventId) {
      rememberLastEventId(eventId);
    }
  }, [eventId]);

  return useMemo(() => {
    if (!eventId) {
      return {
        mode: "global" as const,
        links: buildGlobalLinks(),
      };
    }

    const event = eventQuery.data;
    const navItems = event
      ? visibleEventWorkspaceNavItems({ accessMode: event.accessMode })
      : [];

    const links: AdminNavLink[] = navItems.map((item) => {
      const href = eventWorkspaceNavHref(eventId, item.section);

      return {
        key: item.section,
        label: item.label,
        href,
        isActive: (path) => workspaceLinkIsActive(path, href),
      };
    });

    return {
      mode: "event" as const,
      eventId,
      back: { label: "All events", href: "/events" },
      links,
      eventTitle: event?.title,
      isEventLoading: eventQuery.isLoading && !event,
    };
  }, [eventId, eventQuery.data, eventQuery.isLoading]);
}
