import type { EventDetail, TierRow } from "@/lib/admin-types";
import type { EventPromotionCodeRow } from "@/lib/admin-api";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminDataTable } from "@/components/admin-data-table";
import { promotionCodesColumns } from "@/components/admin-data-table/columns/promotion-codes-columns";
import { EventWorkspaceGate } from "@/components/layout/event-workspace-gate";
import { PromotionCodeFormDialog } from "@/components/promotion-code-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminApi } from "@/hooks/use-admin-api";
import { useEventIdParam } from "@/hooks/use-event-id-param";
import { eventPromotionCodesListService } from "@/lib/admin-list-services";

type EventPromotionsContentProps = {
  eventId: string;
  event: EventDetail;
  tiers: TierRow[];
};

function EventPromotionsContent({
  eventId,
  event,
  tiers,
}: EventPromotionsContentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const patchMutation = useMutation(adminApi.event.patchPromotionCode(eventId));
  const deleteMutation = useMutation(
    adminApi.event.deletePromotionCode(eventId),
  );

  const columns = useMemo(
    () =>
      promotionCodesColumns({
        eventSlug: event.slug,
        inviteOnly: event.accessMode === "invite_only",
        isPatchPending: patchMutation.isPending,
        isDeletePending: deleteMutation.isPending,
        onToggleActive: (row: EventPromotionCodeRow) => {
          patchMutation.mutate(
            {
              promotionCodeId: row.id,
              payload: { active: !row.active },
            },
            {
              onSuccess: () =>
                toast.success(
                  row.active ? "Promotion deactivated" : "Promotion activated",
                ),
            },
          );
        },
        onDelete: (row: EventPromotionCodeRow) => {
          if (
            !confirm(
              `Delete promotion code "${row.code}"? This cannot be undone.`,
            )
          ) {
            return;
          }
          deleteMutation.mutate(row.id, {
            onSuccess: () => toast.success("Promotion code deleted"),
          });
        },
      }),
    [event.slug, event.accessMode, patchMutation, deleteMutation],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">Promotions</h2>
      <Card>
        <CardHeader>
          <CardTitle>Promotion codes</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDataTable
            columns={columns}
            emptyMessage="No promotion codes yet."
            scope={{ eventId }}
            service={eventPromotionCodesListService}
            toolbar={() => (
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  Add promotion code
                </Button>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <PromotionCodeFormDialog
        eventId={eventId}
        open={dialogOpen}
        tiers={tiers}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

export function EventPromotionsPage() {
  const { eventId } = useEventIdParam();

  return (
    <EventWorkspaceGate eventId={eventId}>
      {({ event, tiers }) => (
        <EventPromotionsContent event={event} eventId={eventId} tiers={tiers} />
      )}
    </EventWorkspaceGate>
  );
}
