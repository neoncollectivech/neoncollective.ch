import type { EventInviteeListRow } from "@/lib/admin-api";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { adminApi } from "@/hooks/use-admin-api";
import { useForeignKey } from "@/hooks/use-foreign-key";
import { orderFkService, personFkService } from "@/lib/admin-fk-services";
import { InviteeTreeFetchError } from "@/lib/fetch-all-event-invitees";
import {
  ancestorIds,
  buildInviteeForest,
  collectForestNodes,
  defaultCollapsedIds,
} from "@/lib/invitee-tree/build-invitee-forest";
import { matchesSearch } from "@/lib/invitee-tree/display-label";
import { layoutInviteeForest } from "@/lib/invitee-tree/layout-invitee-forest";
import { computeForestStats } from "@/lib/invitee-tree/stats";

import { InviteeTreeCanvas } from "./invitee-tree-canvas";
import { InviteeTreeDetailPanel } from "./invitee-tree-detail-panel";
import { InviteeTreeSummary } from "./invitee-tree-summary";
import { InviteeTreeToolbar } from "./invitee-tree-toolbar";

type InviteeTreeViewProps = {
  eventId: string;
  eventSlug: string;
  defaultInviteLinkMaxRedemptions: number;
  onSwitchToList: () => void;
};

export function InviteeTreeView({
  eventId,
  eventSlug,
  defaultInviteLinkMaxRedemptions,
  onSwitchToList,
}: InviteeTreeViewProps) {
  const treeQuery = useQuery(adminApi.event.inviteeTreeAll(eventId));
  const [search, setSearch] = useState("");
  const [showRevoked, setShowRevoked] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedInvitee, setSelectedInvitee] =
    useState<EventInviteeListRow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const collapseSeedRef = useRef<string | null>(null);

  const invitees = treeQuery.data ?? [];

  const forest = useMemo(
    () => (invitees.length > 0 ? buildInviteeForest(invitees) : null),
    [invitees],
  );

  useEffect(() => {
    if (!forest || collapseSeedRef.current === eventId) {
      return;
    }

    collapseSeedRef.current = eventId;
    setCollapsedIds(defaultCollapsedIds(forest));
  }, [forest, eventId]);

  const fkSourceRows = useMemo(
    () =>
      invitees.flatMap((invitee) => {
        const rows: Array<{ personId: string | null }> = [];

        if (invitee.personId) {
          rows.push({ personId: invitee.personId });
        }
        if (invitee.inviterId) {
          rows.push({ personId: invitee.inviterId });
        }

        return rows;
      }),
    [invitees],
  );

  const fk = useForeignKey({
    rows: fkSourceRows,
    load: [personFkService, orderFkService],
    scope: { eventId },
  });

  const personLookup = fk.lookups.person;
  const searchTrimmed = search.trim();

  const highlightedIds = useMemo(() => {
    if (!forest || !searchTrimmed) {
      return new Set<string>();
    }

    const matches = new Set<string>();

    for (const node of collectForestNodes(forest)) {
      if (matchesSearch(node.invitee, personLookup, searchTrimmed)) {
        for (const id of ancestorIds(forest, node.invitee.id)) {
          matches.add(id);
        }
        matches.add(node.invitee.id);
      }
    }

    return matches;
  }, [forest, personLookup, searchTrimmed]);

  const effectiveCollapsedIds = useMemo(() => {
    if (!searchTrimmed) {
      return collapsedIds;
    }

    const next = new Set(collapsedIds);

    for (const id of highlightedIds) {
      next.delete(id);
    }

    return next;
  }, [collapsedIds, highlightedIds, searchTrimmed]);

  const layout = useMemo(() => {
    if (!forest) {
      return null;
    }

    return layoutInviteeForest(forest, effectiveCollapsedIds, showRevoked);
  }, [forest, effectiveCollapsedIds, showRevoked]);

  const stats = forest ? computeForestStats(forest) : null;

  if (treeQuery.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <InlineSpinner />
        Loading invite tree…
      </div>
    );
  }

  if (treeQuery.isError) {
    const message =
      treeQuery.error instanceof InviteeTreeFetchError
        ? treeQuery.error.message
        : "Failed to load invite tree.";

    return <p className="text-sm text-red-400">{message}</p>;
  }

  if (!forest || (forest.roots.length === 0 && forest.orphans.length === 0)) {
    return (
      <div className="space-y-3">
        {stats ? <InviteeTreeSummary orphanCount={0} stats={stats} /> : null}
        <p className="text-sm text-muted-foreground">
          No invite chains yet. Hosts appear here once someone joins through
          their invite link.
        </p>
        <Button
          size="sm"
          type="button"
          variant="outline"
          onClick={onSwitchToList}
        >
          View all invitees in list
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats ? (
        <InviteeTreeSummary orphanCount={forest.orphans.length} stats={stats} />
      ) : null}

      <InviteeTreeToolbar
        search={search}
        showRevoked={showRevoked}
        onCollapseAll={() => {
          if (!forest) {
            return;
          }

          setCollapsedIds(
            new Set(
              collectForestNodes(forest)
                .filter((node) => node.children.length > 0)
                .map((node) => node.invitee.id),
            ),
          );
        }}
        onExpandAll={() => setCollapsedIds(new Set())}
        onSearchChange={setSearch}
        onShowRevokedChange={setShowRevoked}
      />

      {forest.orphans.length > 0 ? (
        <p className="text-xs text-yellow-500/90">
          Unlinked chains: invitees whose inviter is not on this event&apos;s
          invite list.
        </p>
      ) : null}

      {layout ? (
        <InviteeTreeCanvas
          collapsedIds={effectiveCollapsedIds}
          highlightedIds={highlightedIds}
          layout={layout}
          orderLookup={fk.lookups.order}
          personLookup={personLookup}
          searchActive={Boolean(searchTrimmed)}
          onSelect={(invitee) => {
            setSelectedInvitee(invitee);
            setDetailOpen(true);
          }}
          onToggleCollapse={(inviteeId) => {
            setCollapsedIds((current) => {
              const next = new Set(current);

              if (next.has(inviteeId)) {
                next.delete(inviteeId);
              } else {
                next.add(inviteeId);
              }

              return next;
            });
          }}
        />
      ) : null}

      <InviteeTreeDetailPanel
        defaultInviteLinkMaxRedemptions={defaultInviteLinkMaxRedemptions}
        eventId={eventId}
        eventSlug={eventSlug}
        fk={fk}
        invitee={selectedInvitee}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setSelectedInvitee(null);
          }
        }}
      />
    </div>
  );
}
