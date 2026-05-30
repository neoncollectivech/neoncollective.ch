import type { EventInviteeListRow } from "@/lib/admin-api";
import type { ForeignKeyLookupRow } from "@/lib/admin-fk-services";
import type { InviteeForestLayout } from "@/lib/invitee-tree/types";

import {
  InviteeTreeEdges,
  inviteeTreeLayoutMetrics,
} from "./invitee-tree-edges";
import { InviteeTreeNodeView } from "./invitee-tree-node";

type InviteeTreeCanvasProps = {
  layout: InviteeForestLayout;
  personLookup: Map<string, ForeignKeyLookupRow> | undefined;
  orderLookup: Map<string, ForeignKeyLookupRow> | undefined;
  collapsedIds: Set<string>;
  highlightedIds: Set<string>;
  searchActive: boolean;
  onToggleCollapse: (inviteeId: string) => void;
  onSelect: (invitee: EventInviteeListRow) => void;
};

export function InviteeTreeCanvas({
  layout,
  personLookup,
  orderLookup,
  collapsedIds,
  highlightedIds,
  searchActive,
  onToggleCollapse,
  onSelect,
}: InviteeTreeCanvasProps) {
  return (
    <div className="max-h-[min(70vh,720px)] overflow-auto rounded-md border border-border bg-background/50">
      <div
        className="relative"
        style={{
          width: layout.width,
          height: layout.height,
          minWidth: "100%",
        }}
      >
        <InviteeTreeEdges layout={layout} />
        {layout.positions.map((position) => (
          <div
            key={position.inviteeId}
            className="absolute"
            style={{
              left: position.x + inviteeTreeLayoutMetrics.PADDING,
              top: position.y + inviteeTreeLayoutMetrics.PADDING,
            }}
          >
            <InviteeTreeNodeView
              collapsed={collapsedIds.has(position.inviteeId)}
              dimmed={searchActive && !highlightedIds.has(position.inviteeId)}
              highlighted={highlightedIds.has(position.inviteeId)}
              node={position.node}
              orderLookup={orderLookup}
              personLookup={personLookup}
              onSelect={onSelect}
              onToggleCollapse={() => onToggleCollapse(position.inviteeId)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
