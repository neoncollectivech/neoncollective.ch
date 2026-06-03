import type { EventWorkspaceSection } from "@/lib/event-workspace-paths";

import { eventWorkspaceSectionPath } from "@/lib/event-workspace-paths";

export type EventWorkspaceNavContext = {
  accessMode: string;
};

export type EventWorkspaceNavItem = {
  section: EventWorkspaceSection;
  label: string;
  visible?: (event: EventWorkspaceNavContext) => boolean;
};

export const eventWorkspaceNavItems: EventWorkspaceNavItem[] = [
  { section: "overview", label: "Overview" },
  { section: "settings", label: "Settings" },
  { section: "tiers", label: "Tiers" },
  { section: "promotions", label: "Promotions" },
  {
    section: "invitees",
    label: "Invitees",
    visible: (event) => event.accessMode === "invite_only",
  },
  { section: "orders", label: "Orders" },
  { section: "admissions", label: "Admissions" },
  { section: "api-keys", label: "API keys" },
];

export function eventWorkspaceNavHref(
  eventId: string,
  section: EventWorkspaceSection,
): string {
  return eventWorkspaceSectionPath(eventId, section);
}

export function visibleEventWorkspaceNavItems(
  event: EventWorkspaceNavContext,
): EventWorkspaceNavItem[] {
  return eventWorkspaceNavItems.filter(
    (item) => item.visible == null || item.visible(event),
  );
}
