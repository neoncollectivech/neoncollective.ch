import type { LucideIcon } from "lucide-react";
import type { EventWorkspaceSection } from "@/lib/event-workspace-paths";

import {
  KeyRound,
  LayoutDashboard,
  Layers,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  UserPlus,
} from "lucide-react";

import { eventWorkspaceSectionPath } from "@/lib/event-workspace-paths";

export type EventWorkspaceNavContext = {
  accessMode: string;
};

export type EventWorkspaceNavGroup = "setup" | "sales" | "door";

export type EventWorkspaceNavItem = {
  section: EventWorkspaceSection;
  label: string;
  group: EventWorkspaceNavGroup;
  icon: LucideIcon;
  visible?: (event: EventWorkspaceNavContext) => boolean;
};

export const EVENT_WORKSPACE_NAV_GROUP_LABELS: Record<
  EventWorkspaceNavGroup,
  string
> = {
  setup: "Setup",
  sales: "Sales",
  door: "Door",
};

export const EVENT_WORKSPACE_NAV_GROUP_ORDER: EventWorkspaceNavGroup[] = [
  "setup",
  "sales",
  "door",
];

export const eventWorkspaceNavItems: EventWorkspaceNavItem[] = [
  {
    section: "overview",
    label: "Overview",
    group: "setup",
    icon: LayoutDashboard,
  },
  {
    section: "settings",
    label: "Settings",
    group: "setup",
    icon: Settings,
  },
  { section: "tiers", label: "Tiers", group: "setup", icon: Layers },
  {
    section: "promotions",
    label: "Promotions",
    group: "setup",
    icon: Tag,
  },
  {
    section: "invitees",
    label: "Invitees",
    group: "setup",
    icon: UserPlus,
    visible: (event) => event.accessMode === "invite_only",
  },
  {
    section: "orders",
    label: "Orders",
    group: "sales",
    icon: ShoppingCart,
  },
  {
    section: "admissions",
    label: "Admissions",
    group: "door",
    icon: Ticket,
  },
  {
    section: "api-keys",
    label: "Event API keys",
    group: "door",
    icon: KeyRound,
  },
];

const sectionLabelByKey = new Map(
  eventWorkspaceNavItems.map((item) => [item.section, item.label]),
);

export function eventWorkspaceSectionLabel(
  section: EventWorkspaceSection,
): string {
  return sectionLabelByKey.get(section) ?? section;
}

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
