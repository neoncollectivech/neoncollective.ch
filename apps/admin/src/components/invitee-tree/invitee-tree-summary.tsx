import type { InviteeForestStats } from "@/lib/invitee-tree/types";

type InviteeTreeSummaryProps = {
  stats: InviteeForestStats;
  orphanCount: number;
};

export function InviteeTreeSummary({
  stats,
  orphanCount,
}: InviteeTreeSummaryProps) {
  const parts = [
    `${stats.activeRootCount} active root${stats.activeRootCount === 1 ? "" : "s"}`,
    `${stats.nodesInTree} in tree`,
    stats.maxDepth > 0 ? `max depth ${stats.maxDepth}` : null,
    stats.hiddenRootCount > 0
      ? `${stats.hiddenRootCount} root${stats.hiddenRootCount === 1 ? "" : "s"} hidden (no guests yet)`
      : null,
    orphanCount > 0
      ? `${orphanCount} unlinked chain${orphanCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);

  return <p className="text-sm text-muted-foreground">{parts.join(" · ")}</p>;
}
