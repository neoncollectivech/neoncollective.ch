import type { LucideIcon } from "lucide-react";

import { CalendarDays, Key, Users, Wrench } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

import { adminApi } from "@/hooks/use-admin-api";
import {
  EVENT_WORKSPACE_NAV_GROUP_LABELS,
  EVENT_WORKSPACE_NAV_GROUP_ORDER,
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
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
};

export type AdminNavSection = {
  id: string;
  label: string;
  links: AdminNavLink[];
};

export type AdminSidebarModel = {
  mode: "global" | "event";
  eventId?: string;
  eventTitle?: string;
  isEventLoading?: boolean;
  sections: AdminNavSection[];
  secondarySections?: AdminNavSection[];
};

type GlobalNavGroup = "work" | "access" | "system";

const GLOBAL_NAV_GROUP_LABELS: Record<GlobalNavGroup, string> = {
  work: "Work",
  access: "Access",
  system: "System",
};

const GLOBAL_NAV_GROUP_ORDER: GlobalNavGroup[] = ["work", "access", "system"];

const GLOBAL_LINKS: {
  key: string;
  label: string;
  href: string;
  group: GlobalNavGroup;
  icon: LucideIcon;
}[] = [
  {
    key: "events",
    label: "Events",
    href: "/events",
    group: "work",
    icon: CalendarDays,
  },
  {
    key: "people",
    label: "People",
    href: "/people",
    group: "work",
    icon: Users,
  },
  {
    key: "api-keys",
    label: "Global API keys",
    href: "/api-keys",
    group: "access",
    icon: Key,
  },
  {
    key: "maintenance",
    label: "Maintenance",
    href: "/maintenance",
    group: "system",
    icon: Wrench,
  },
];

const SECONDARY_EVENT_LINK_KEYS = new Set(["people", "api-keys"]);

function globalLinkIsActive(
  key: string,
  href: string,
  pathname: string,
): boolean {
  if (key === "events") {
    return pathname === "/events" || pathname === "/events/new";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildGlobalLink(item: (typeof GLOBAL_LINKS)[number]): AdminNavLink {
  return {
    key: item.key,
    label: item.label,
    href: item.href,
    icon: item.icon,
    isActive: (pathname) => globalLinkIsActive(item.key, item.href, pathname),
  };
}

type AdminNavLinkWithGroup = AdminNavLink & { group: string };

function groupLinksIntoSections(
  links: AdminNavLinkWithGroup[],
  groupOrder: string[],
  groupLabels: Record<string, string>,
): AdminNavSection[] {
  const sections: AdminNavSection[] = [];

  for (const group of groupOrder) {
    const groupLinks = links.filter((link) => link.group === group);

    if (groupLinks.length === 0) {
      continue;
    }

    sections.push({
      id: group,
      label: groupLabels[group] ?? group,
      links: groupLinks,
    });
  }

  return sections;
}

function buildGlobalSections(): AdminNavSection[] {
  const links: AdminNavLinkWithGroup[] = GLOBAL_LINKS.map((item) => ({
    ...buildGlobalLink(item),
    group: item.group,
  }));

  return groupLinksIntoSections(
    links,
    GLOBAL_NAV_GROUP_ORDER,
    GLOBAL_NAV_GROUP_LABELS,
  );
}

function buildSecondarySections(): AdminNavSection[] {
  const links = GLOBAL_LINKS.filter((item) =>
    SECONDARY_EVENT_LINK_KEYS.has(item.key),
  ).map(buildGlobalLink);

  return [{ id: "directory", label: "Directory", links }];
}

function workspaceLinkIsActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function buildEventSections(
  eventId: string,
  accessMode: string,
): AdminNavSection[] {
  const navItems = visibleEventWorkspaceNavItems({ accessMode });
  const links: AdminNavLinkWithGroup[] = navItems.map((item) => {
    const href = eventWorkspaceNavHref(eventId, item.section);

    return {
      key: item.section,
      label: item.label,
      href,
      icon: item.icon,
      group: item.group,
      isActive: (path) => workspaceLinkIsActive(path, href),
    };
  });

  return groupLinksIntoSections(
    links,
    EVENT_WORKSPACE_NAV_GROUP_ORDER,
    EVENT_WORKSPACE_NAV_GROUP_LABELS,
  );
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
        sections: buildGlobalSections(),
      };
    }

    const event = eventQuery.data;

    return {
      mode: "event" as const,
      eventId,
      sections: event ? buildEventSections(eventId, event.accessMode) : [],
      secondarySections: buildSecondarySections(),
      eventTitle: event?.title,
      isEventLoading: eventQuery.isLoading && !event,
    };
  }, [eventId, eventQuery.data, eventQuery.isLoading]);
}
