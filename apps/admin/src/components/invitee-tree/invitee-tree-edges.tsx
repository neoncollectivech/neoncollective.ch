import type { InviteeForestLayout } from "@/lib/invitee-tree/types";

import {
  inviteeTreeLayoutMetrics,
  nodeCenterBottom,
  nodeCenterTop,
} from "@/lib/invitee-tree/layout-invitee-forest";

type InviteeTreeEdgesProps = {
  layout: InviteeForestLayout;
};

export function InviteeTreeEdges({ layout }: InviteeTreeEdgesProps) {
  const positionsById = new Map(
    layout.positions.map((position) => [position.inviteeId, position]),
  );

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      height={layout.height}
      width={layout.width}
    >
      {layout.edges.map((edge) => {
        const parent = positionsById.get(edge.parentId);
        const child = positionsById.get(edge.childId);

        if (!parent || !child) {
          return null;
        }

        const from = nodeCenterBottom(parent);
        const to = nodeCenterTop(child);
        const pad = inviteeTreeLayoutMetrics.PADDING;
        const fromX = from.x + pad;
        const fromY = from.y + pad;
        const toX = to.x + pad;
        const toY = to.y + pad;
        const midY = (fromY + toY) / 2;

        return (
          <path
            key={`${edge.parentId}-${edge.childId}`}
            d={`M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
          />
        );
      })}
    </svg>
  );
}

export { inviteeTreeLayoutMetrics };
