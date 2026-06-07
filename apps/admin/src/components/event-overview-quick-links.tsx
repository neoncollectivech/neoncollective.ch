import type { LucideIcon } from "lucide-react";

import {
  KeyRound,
  Layers,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  UserPlus,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  eventWorkspaceSectionPath,
  type EventWorkspaceSection,
} from "@/lib/event-workspace-paths";

type QuickLink = {
  section: EventWorkspaceSection;
  label: string;
  icon: LucideIcon;
  visible?: (accessMode: string) => boolean;
};

const QUICK_LINKS: QuickLink[] = [
  { section: "settings", label: "Settings", icon: Settings },
  { section: "tiers", label: "Tiers", icon: Layers },
  { section: "promotions", label: "Promotions", icon: Tag },
  {
    section: "invitees",
    label: "Invitees",
    icon: UserPlus,
    visible: (accessMode) => accessMode === "invite_only",
  },
  { section: "orders", label: "Orders", icon: ShoppingCart },
  { section: "admissions", label: "Admissions", icon: Ticket },
  { section: "api-keys", label: "Event API keys", icon: KeyRound },
];

type EventOverviewQuickLinksProps = {
  eventId: string;
  accessMode: string;
};

export function EventOverviewQuickLinks({
  eventId,
  accessMode,
}: EventOverviewQuickLinksProps) {
  const links = QUICK_LINKS.filter(
    (item) => item.visible == null || item.visible(accessMode),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {links.map((item) => {
        const Icon = item.icon;

        return (
          <Card key={item.section}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full" size="sm" variant="outline">
                <Link to={eventWorkspaceSectionPath(eventId, item.section)}>
                  Open
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
