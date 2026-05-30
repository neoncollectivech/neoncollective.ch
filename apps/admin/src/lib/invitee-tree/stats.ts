import type { InviteeForest, InviteeForestStats } from "./types";

import { collectForestNodes } from "./build-invitee-forest";

export function computeForestStats(forest: InviteeForest): InviteeForestStats {
  const nodes = collectForestNodes(forest);
  let maxDepth = 0;

  for (const node of nodes) {
    maxDepth = Math.max(maxDepth, node.depth);
  }

  return {
    activeRootCount: forest.roots.length,
    nodesInTree: nodes.length,
    maxDepth: nodes.length > 0 ? maxDepth + 1 : 0,
    hiddenRootCount: forest.hiddenRootCount,
  };
}
