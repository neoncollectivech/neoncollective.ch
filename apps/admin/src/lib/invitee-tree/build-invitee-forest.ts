import type { EventInviteeListRow } from "@/lib/admin-api";
import type { InviteeForest, InviteeTreeNode } from "./types";

function countDescendants(children: InviteeTreeNode[]): number {
  return children.reduce((sum, child) => sum + 1 + child.descendantCount, 0);
}

function buildNode(
  invitee: EventInviteeListRow,
  childrenByInviter: Map<string, EventInviteeListRow[]>,
  depth: number,
): InviteeTreeNode {
  const childRows =
    invitee.personId != null
      ? (childrenByInviter.get(invitee.personId) ?? [])
      : [];
  const children = childRows.map((child) =>
    buildNode(child, childrenByInviter, depth + 1),
  );
  const descendantCount = countDescendants(children);

  return {
    invitee,
    children,
    depth,
    descendantCount,
  };
}

function isOrphanRoot(
  invitee: EventInviteeListRow,
  personIdsOnEvent: Set<string>,
): boolean {
  if (!invitee.inviterId) {
    return false;
  }

  return !personIdsOnEvent.has(invitee.inviterId);
}

export function buildInviteeForest(
  invitees: EventInviteeListRow[],
): InviteeForest {
  const personIdsOnEvent = new Set<string>();

  for (const invitee of invitees) {
    if (invitee.personId) {
      personIdsOnEvent.add(invitee.personId);
    }
  }

  const childrenByInviter = new Map<string, EventInviteeListRow[]>();

  for (const invitee of invitees) {
    if (!invitee.inviterId) {
      continue;
    }

    const siblings = childrenByInviter.get(invitee.inviterId) ?? [];

    siblings.push(invitee);
    childrenByInviter.set(invitee.inviterId, siblings);
  }

  for (const [key, rows] of childrenByInviter) {
    rows.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    childrenByInviter.set(key, rows);
  }

  const firstDegree = invitees
    .filter((inv) => inv.inviterId == null)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

  const visibleRoots: InviteeTreeNode[] = [];
  let hiddenRootCount = 0;

  for (const root of firstDegree) {
    const node = buildNode(root, childrenByInviter, 0);

    if (node.descendantCount > 0) {
      visibleRoots.push(node);
    } else {
      hiddenRootCount += 1;
    }
  }

  const orphanRoots = invitees
    .filter((inv) => isOrphanRoot(inv, personIdsOnEvent))
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    )
    .map((inv) => buildNode(inv, childrenByInviter, 0));

  return {
    roots: visibleRoots,
    orphans: orphanRoots,
    hiddenRootCount,
    totalRootCount: firstDegree.length,
  };
}

export function collectForestNodes(forest: InviteeForest): InviteeTreeNode[] {
  const nodes: InviteeTreeNode[] = [];

  function walk(node: InviteeTreeNode) {
    nodes.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of forest.roots) {
    walk(root);
  }
  for (const root of forest.orphans) {
    walk(root);
  }

  return nodes;
}

export function defaultCollapsedIds(forest: InviteeForest): Set<string> {
  const collapsed = new Set<string>();

  function walk(node: InviteeTreeNode) {
    if (node.depth >= 2 && node.children.length > 0) {
      collapsed.add(node.invitee.id);
    }

    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of [...forest.roots, ...forest.orphans]) {
    walk(root);
  }

  return collapsed;
}

export function ancestorIds(
  forest: InviteeForest,
  inviteeId: string,
): string[] {
  const byId = new Map<string, InviteeTreeNode>();

  for (const node of collectForestNodes(forest)) {
    byId.set(node.invitee.id, node);
  }

  const path: string[] = [];
  let current = byId.get(inviteeId);

  while (current) {
    path.unshift(current.invitee.id);
    const inviterId = current.invitee.inviterId;

    if (!inviterId) {
      break;
    }

    current = [...byId.values()].find(
      (node) => node.invitee.personId === inviterId,
    );
  }

  return path;
}
