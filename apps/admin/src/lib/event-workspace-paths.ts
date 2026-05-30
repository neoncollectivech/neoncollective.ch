import { isUuid } from "@/lib/uuid";

export const EVENT_WORKSPACE_RECENTS_KEY = "neon:admin:recentEventIds";

const MAX_RECENTS = 5;

export type EventWorkspaceSection =
  | "overview"
  | "settings"
  | "tiers"
  | "promotions"
  | "invitees"
  | "orders";

const WORKSPACE_SECTIONS = new Set<string>([
  "overview",
  "settings",
  "tiers",
  "promotions",
  "invitees",
  "orders",
]);

/** Event workspace routes: `/events/:uuid` and `/events/:uuid/...` (not `/events/new`). */
export function parseEventWorkspaceEventId(
  pathname: string,
): string | undefined {
  const match = pathname.match(/^\/events\/([^/]+)(?:\/|$)/);
  const id = match?.[1];

  if (!id || id === "new" || !isUuid(id)) {
    return undefined;
  }

  return id;
}

export function isEventWorkspaceRoute(pathname: string): boolean {
  return parseEventWorkspaceEventId(pathname) != null;
}

export function eventBasePath(eventId: string): string {
  return `/events/${eventId}`;
}

export function eventOverviewPath(eventId: string): string {
  return `${eventBasePath(eventId)}/overview`;
}

export function eventSettingsPath(eventId: string): string {
  return `${eventBasePath(eventId)}/settings`;
}

export function eventTiersPath(eventId: string): string {
  return `${eventBasePath(eventId)}/tiers`;
}

export function eventPromotionsPath(eventId: string): string {
  return `${eventBasePath(eventId)}/promotions`;
}

export function eventInviteesPath(eventId: string): string {
  return `${eventBasePath(eventId)}/invitees`;
}

export function eventOrdersPath(eventId: string): string {
  return `${eventBasePath(eventId)}/orders`;
}

export function eventOrderPath(eventId: string, orderId: string): string {
  return `${eventBasePath(eventId)}/orders/${orderId}`;
}

export function eventWorkspaceSectionPath(
  eventId: string,
  section: EventWorkspaceSection,
): string {
  return `${eventBasePath(eventId)}/${section}`;
}

/** Section suffix after `/events/:eventId/` for event switcher navigation. */
export function workspaceSuffixFromPathname(pathname: string): string {
  const match = pathname.match(/\/events\/[^/]+\/(.+)$/);

  if (!match) {
    return "overview";
  }

  const suffix = match[1]!;

  if (/^orders\/[^/]+$/.test(suffix)) {
    return "orders";
  }

  const first = suffix.split("/")[0] ?? "overview";

  return WORKSPACE_SECTIONS.has(first) ? first : "overview";
}

export function pathAfterEventSwitch(
  newEventId: string,
  suffix: string,
): string {
  if (suffix === "orders" || suffix.startsWith("orders/")) {
    return eventOrdersPath(newEventId);
  }

  if (WORKSPACE_SECTIONS.has(suffix)) {
    return eventWorkspaceSectionPath(
      newEventId,
      suffix as EventWorkspaceSection,
    );
  }

  return eventOverviewPath(newEventId);
}

export function rememberLastEventId(eventId: string): void {
  if (!isUuid(eventId)) {
    return;
  }

  try {
    const recent = readRecentEventIds().filter((id) => id !== eventId);

    recent.unshift(eventId);
    localStorage.setItem(
      EVENT_WORKSPACE_RECENTS_KEY,
      JSON.stringify(recent.slice(0, MAX_RECENTS)),
    );
  } catch {
    // ignore storage errors
  }
}

export function readRecentEventIds(): string[] {
  try {
    const raw = localStorage.getItem(EVENT_WORKSPACE_RECENTS_KEY);

    if (!raw) {
      return [];
    }

    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (id): id is string => typeof id === "string" && isUuid(id),
    );
  } catch {
    return [];
  }
}
