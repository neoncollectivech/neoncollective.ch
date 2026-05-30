import type { EventInviteeListRow } from "@/lib/admin-api";
import type { ForeignKeyLookupRow } from "@/lib/admin-fk-services";
import type { InviteeTreeNode } from "@/lib/invitee-tree/types";

import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { displayName, initials } from "@/lib/invitee-tree/display-label";
import {
  inviteeVisualStatus,
  statusRingClass,
} from "@/lib/invitee-tree/invitee-status";
import { inviteeTreeLayoutMetrics } from "@/lib/invitee-tree/layout-invitee-forest";
import { cn } from "@/lib/utils";

type InviteeTreeNodeViewProps = {
  node: InviteeTreeNode;
  personLookup: Map<string, ForeignKeyLookupRow> | undefined;
  orderLookup: Map<string, ForeignKeyLookupRow> | undefined;
  collapsed: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onToggleCollapse: () => void;
  onSelect: (invitee: EventInviteeListRow) => void;
};

export function InviteeTreeNodeView({
  node,
  personLookup,
  orderLookup,
  collapsed,
  highlighted,
  dimmed,
  onToggleCollapse,
  onSelect,
}: InviteeTreeNodeViewProps) {
  const { invitee } = node;
  const hasChildren = node.children.length > 0;
  const hiddenCount = collapsed ? node.descendantCount : 0;
  const status = inviteeVisualStatus(invitee, orderLookup);
  const isRoot = node.depth === 0;
  const label = displayName(invitee, personLookup);

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2",
        dimmed && "opacity-35",
        invitee.revokedAt && "opacity-50",
      )}
      style={{ width: inviteeTreeLayoutMetrics.NODE_WIDTH }}
    >
      <div className="relative flex items-center justify-center">
        {hasChildren ? (
          <Button
            aria-label={collapsed ? "Expand branch" : "Collapse branch"}
            className="absolute -left-2 -top-2 z-10 h-6 w-6 rounded-full p-0"
            size="sm"
            type="button"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCollapse();
            }}
          >
            {collapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        ) : null}
        <Button
          className={cn(
            "h-auto min-h-0 flex-col gap-1 rounded-md px-1 py-1 hover:bg-muted/50",
            highlighted &&
              "ring-2 ring-primary ring-offset-2 ring-offset-background",
          )}
          type="button"
          variant="ghost"
          onClick={() => onSelect(invitee)}
        >
          <span
            className={cn(
              "flex items-center justify-center rounded-full border-2 bg-muted font-semibold ring-2 ring-offset-2 ring-offset-background",
              isRoot ? "size-14 text-sm" : "size-12 text-xs",
              statusRingClass(status),
            )}
          >
            {initials(invitee, personLookup)}
          </span>
          <span className="max-w-full truncate text-center text-xs">
            {label}
          </span>
          {isRoot ? (
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Host
            </span>
          ) : null}
        </Button>
        {hiddenCount > 0 ? (
          <span className="absolute -bottom-1 -right-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium">
            +{hiddenCount}
          </span>
        ) : null}
      </div>
    </div>
  );
}
