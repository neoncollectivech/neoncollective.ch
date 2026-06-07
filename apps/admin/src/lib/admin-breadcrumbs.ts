import { eventWorkspaceSectionLabel } from "@/lib/event-workspace-nav";
import {
  eventOrdersPath,
  eventOverviewPath,
  eventWorkspaceSectionPath,
  parseEventWorkspaceEventId,
  type EventWorkspaceSection,
} from "@/lib/event-workspace-paths";

export type AdminBreadcrumbSegment = {
  key: string;
  label: string;
  href?: string;
};

export type AdminBreadcrumbContext = {
  eventTitle?: string;
  personName?: string;
  admissionGuestName?: string;
};

const WORKSPACE_SECTIONS = new Set<string>([
  "overview",
  "settings",
  "tiers",
  "promotions",
  "invitees",
  "orders",
  "admissions",
  "api-keys",
]);

function eventBreadcrumbBase(
  eventId: string,
  eventTitle: string,
): AdminBreadcrumbSegment[] {
  return [
    { key: "events", label: "Events", href: "/events" },
    {
      key: `event-${eventId}`,
      label: eventTitle,
      href: eventOverviewPath(eventId),
    },
  ];
}

export function buildAdminBreadcrumbs(
  pathname: string,
  ctx: AdminBreadcrumbContext,
): AdminBreadcrumbSegment[] {
  if (pathname === "/events") {
    return [{ key: "events", label: "Events" }];
  }

  if (pathname === "/events/new") {
    return [
      { key: "events", label: "Events", href: "/events" },
      { key: "new-event", label: "New event" },
    ];
  }

  if (pathname === "/people") {
    return [{ key: "people", label: "People" }];
  }

  if (pathname === "/api-keys") {
    return [{ key: "api-keys", label: "Global API keys" }];
  }

  if (pathname === "/maintenance") {
    return [{ key: "maintenance", label: "Maintenance" }];
  }

  const personMatch = pathname.match(/^\/people\/([^/]+)$/);

  if (personMatch) {
    const personId = personMatch[1]!;

    return [
      { key: "people", label: "People", href: "/people" },
      {
        key: `person-${personId}`,
        label: ctx.personName?.trim() || "Person",
      },
    ];
  }

  const eventId = parseEventWorkspaceEventId(pathname);

  if (!eventId) {
    return [];
  }

  const eventTitle = ctx.eventTitle?.trim() || "Event";
  const base = eventBreadcrumbBase(eventId, eventTitle);

  const orderMatch = pathname.match(/^\/events\/[^/]+\/orders\/([^/]+)$/);

  if (orderMatch) {
    const orderId = orderMatch[1]!;

    return [
      ...base,
      { key: "orders", label: "Orders", href: eventOrdersPath(eventId) },
      { key: `order-${orderId}`, label: "Order" },
    ];
  }

  const admissionMatch = pathname.match(
    /^\/events\/[^/]+\/admissions\/([^/]+)$/,
  );

  if (admissionMatch) {
    const admissionId = admissionMatch[1]!;

    return [
      ...base,
      {
        key: "admissions",
        label: "Admissions",
        href: eventWorkspaceSectionPath(eventId, "admissions"),
      },
      {
        key: `admission-${admissionId}`,
        label: ctx.admissionGuestName?.trim() || "Admission",
      },
    ];
  }

  const sectionMatch = pathname.match(/^\/events\/[^/]+\/([^/]+)$/);

  if (sectionMatch) {
    const section = sectionMatch[1]!;

    if (WORKSPACE_SECTIONS.has(section)) {
      return [
        ...base,
        {
          key: section,
          label: eventWorkspaceSectionLabel(section as EventWorkspaceSection),
        },
      ];
    }
  }

  return base;
}
