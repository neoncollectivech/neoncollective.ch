import type {
  InviteeForest,
  InviteeForestLayout,
  InviteeTreeNode,
  LayoutPosition,
} from "./types";

const NODE_WIDTH = 88;
const NODE_HEIGHT = 96;
const H_GAP = 24;
const V_GAP = 56;
const ROOT_GAP = 48;
const PADDING = 32;

type SubtreeLayout = {
  width: number;
  height: number;
  positions: LayoutPosition[];
  edges: Array<{ parentId: string; childId: string }>;
};

function isNodeVisible(node: InviteeTreeNode, showRevoked: boolean): boolean {
  if (showRevoked) {
    return true;
  }

  return !node.invitee.revokedAt;
}

function visibleChildren(
  node: InviteeTreeNode,
  collapsedIds: Set<string>,
  showRevoked: boolean,
): InviteeTreeNode[] {
  if (collapsedIds.has(node.invitee.id)) {
    return [];
  }

  return node.children.filter((child) => isNodeVisible(child, showRevoked));
}

function layoutSubtree(
  node: InviteeTreeNode,
  collapsedIds: Set<string>,
  showRevoked: boolean,
  offsetX: number,
  depth: number,
): SubtreeLayout {
  const children = visibleChildren(node, collapsedIds, showRevoked);
  const y = depth * (NODE_HEIGHT + V_GAP);

  if (children.length === 0) {
    return {
      width: NODE_WIDTH,
      height: y + NODE_HEIGHT,
      positions: [
        {
          inviteeId: node.invitee.id,
          x: offsetX,
          y,
          depth,
          node,
        },
      ],
      edges: [],
    };
  }

  const childLayouts: SubtreeLayout[] = [];
  let cursor = 0;

  for (const child of children) {
    const layout = layoutSubtree(
      child,
      collapsedIds,
      showRevoked,
      offsetX + cursor,
      depth + 1,
    );

    childLayouts.push(layout);
    cursor += layout.width + H_GAP;
  }

  const childrenWidth =
    childLayouts.reduce((sum, layout) => sum + layout.width, 0) +
    H_GAP * Math.max(0, childLayouts.length - 1);
  const subtreeWidth = Math.max(NODE_WIDTH, childrenWidth);
  const parentX = offsetX + (subtreeWidth - NODE_WIDTH) / 2;
  const childOffset = offsetX + (subtreeWidth - childrenWidth) / 2;

  let childCursor = childOffset;
  const positions: LayoutPosition[] = [
    {
      inviteeId: node.invitee.id,
      x: parentX,
      y,
      depth,
      node,
    },
  ];
  const edges: Array<{ parentId: string; childId: string }> = [];

  for (const layout of childLayouts) {
    const shift = childCursor - layout.positions[0]!.x;

    for (const position of layout.positions) {
      positions.push({
        ...position,
        x: position.x + shift,
      });
    }

    for (const edge of layout.edges) {
      edges.push(edge);
    }

    edges.push({
      parentId: node.invitee.id,
      childId: layout.positions[0]!.inviteeId,
    });

    childCursor += layout.width + H_GAP;
  }

  const height = Math.max(
    y + NODE_HEIGHT,
    ...childLayouts.map((layout) => layout.height),
  );

  return {
    width: subtreeWidth,
    height,
    positions,
    edges,
  };
}

function layoutForestSection(
  roots: InviteeTreeNode[],
  collapsedIds: Set<string>,
  showRevoked: boolean,
): SubtreeLayout {
  const visibleRoots = roots.filter((root) => isNodeVisible(root, showRevoked));

  if (visibleRoots.length === 0) {
    return { width: 0, height: 0, positions: [], edges: [] };
  }

  let cursor = 0;
  const positions: LayoutPosition[] = [];
  const edges: Array<{ parentId: string; childId: string }> = [];
  let maxHeight = 0;

  for (const root of visibleRoots) {
    const layout = layoutSubtree(root, collapsedIds, showRevoked, cursor, 0);

    positions.push(...layout.positions);
    edges.push(...layout.edges);
    maxHeight = Math.max(maxHeight, layout.height);
    cursor += layout.width + ROOT_GAP;
  }

  return {
    width: Math.max(0, cursor - ROOT_GAP),
    height: maxHeight,
    positions,
    edges,
  };
}

export function layoutInviteeForest(
  forest: InviteeForest,
  collapsedIds: Set<string>,
  showRevoked: boolean,
): InviteeForestLayout {
  const main = layoutForestSection(forest.roots, collapsedIds, showRevoked);
  const orphanYOffset = main.height > 0 ? main.height + V_GAP * 2 : 0;
  const orphans = layoutForestSection(
    forest.orphans,
    collapsedIds,
    showRevoked,
  );

  const orphanPositions = orphans.positions.map((position) => ({
    ...position,
    y: position.y + orphanYOffset,
  }));

  return {
    positions: [...main.positions, ...orphanPositions],
    edges: [...main.edges, ...orphans.edges],
    width: Math.max(main.width, orphans.width) + PADDING * 2,
    height: Math.max(main.height, orphanYOffset + orphans.height) + PADDING * 2,
  };
}

export const inviteeTreeLayoutMetrics = {
  NODE_WIDTH,
  NODE_HEIGHT,
  PADDING,
} as const;

export function nodeCenterBottom(position: LayoutPosition): {
  x: number;
  y: number;
} {
  return {
    x: position.x + inviteeTreeLayoutMetrics.NODE_WIDTH / 2,
    y: position.y + inviteeTreeLayoutMetrics.NODE_HEIGHT - 12,
  };
}

export function nodeCenterTop(position: LayoutPosition): {
  x: number;
  y: number;
} {
  return {
    x: position.x + inviteeTreeLayoutMetrics.NODE_WIDTH / 2,
    y: position.y + 8,
  };
}
