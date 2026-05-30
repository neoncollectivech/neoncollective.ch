import type { EventInviteeListRow } from "@/lib/admin-api";

export type InviteeTreeNode = {
  invitee: EventInviteeListRow;
  children: InviteeTreeNode[];
  depth: number;
  descendantCount: number;
};

export type InviteeForest = {
  roots: InviteeTreeNode[];
  orphans: InviteeTreeNode[];
  hiddenRootCount: number;
  totalRootCount: number;
};

export type LayoutPosition = {
  inviteeId: string;
  x: number;
  y: number;
  depth: number;
  node: InviteeTreeNode;
};

export type InviteeForestLayout = {
  positions: LayoutPosition[];
  width: number;
  height: number;
  edges: Array<{ parentId: string; childId: string }>;
};

export type InviteeForestStats = {
  activeRootCount: number;
  nodesInTree: number;
  maxDepth: number;
  hiddenRootCount: number;
};
