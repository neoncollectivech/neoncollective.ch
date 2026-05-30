import type { EventPromotionCodeRow } from "@/lib/admin-api";
import type { AdminColumnDef } from "@/components/admin-data-table/types";

import { toast } from "sonner";

import {
  adminActionsColumn,
  adminDateColumn,
  adminTextColumn,
} from "@/components/admin-data-table/column-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildPublicPromoUrl } from "@/lib/invite-url";

export type PromotionCodesColumnsOptions = {
  eventSlug: string;
  inviteOnly: boolean;
  isPatchPending: boolean;
  isDeletePending: boolean;
  onToggleActive: (row: EventPromotionCodeRow) => void;
  onDelete: (row: EventPromotionCodeRow) => void;
};

function formatKind(row: EventPromotionCodeRow): string {
  if (row.kind === "percent_off") {
    return `${((row.percentBps ?? 0) / 100).toFixed(0)}% off`;
  }
  if (row.kind === "amount_off") {
    return `CHF ${((row.amountOffCents ?? 0) / 100).toFixed(2)} off`;
  }

  return "Tier prices";
}

function formatRedemptions(row: EventPromotionCodeRow): string {
  if (row.maxRedemptions == null) {
    return `${row.usedRedemptions} / ∞`;
  }

  return `${row.usedRedemptions} / ${row.maxRedemptions}`;
}

async function copyPromoLink(
  eventSlug: string,
  inviteOnly: boolean,
  promoCode: string,
) {
  const url = buildPublicPromoUrl(eventSlug, inviteOnly, promoCode);

  await navigator.clipboard.writeText(url);
  toast.success("Promotion link copied");
}

export function promotionCodesColumns(
  opts: PromotionCodesColumnsOptions,
): AdminColumnDef<EventPromotionCodeRow>[] {
  return [
    adminTextColumn("code", {
      header: "Code",
      sortable: true,
      className: "font-mono",
    }),
    {
      id: "effect",
      header: "Effect",
      enableSorting: false,
      cell: ({ row }) => formatKind(row.original),
    },
    {
      id: "used",
      header: "Used",
      enableSorting: false,
      cell: ({ row }) => formatRedemptions(row.original),
    },
    {
      id: "status",
      accessorKey: "active",
      header: "Status",
      enableSorting: true,
      meta: { sortable: true },
      cell: ({ row }) =>
        row.original.active ? (
          <Badge>Active</Badge>
        ) : (
          <Badge variant="secondary">Inactive</Badge>
        ),
    },
    adminDateColumn("createdAt", { header: "Created", sortable: true }),
    adminActionsColumn({
      cell: ({ row }) => {
        const promo = row.original;

        return (
          <div className="space-x-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                void copyPromoLink(opts.eventSlug, opts.inviteOnly, promo.code)
              }
            >
              Copy link
            </Button>
            <Button
              disabled={opts.isPatchPending}
              size="sm"
              variant="ghost"
              onClick={() => opts.onToggleActive(promo)}
            >
              {promo.active ? "Deactivate" : "Activate"}
            </Button>
            {promo.usedRedemptions === 0 ? (
              <Button
                disabled={opts.isDeletePending}
                size="sm"
                variant="destructive"
                onClick={() => opts.onDelete(promo)}
              >
                Delete
              </Button>
            ) : null}
          </div>
        );
      },
    }),
  ];
}
