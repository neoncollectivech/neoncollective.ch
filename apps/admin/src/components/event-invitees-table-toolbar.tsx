import type { AdminDataTableContext } from "@/components/admin-data-table";
import type { EventInviteeListRow } from "@/lib/admin-api";

import { Select } from "@/components/ui/select";
import {
  INVITEE_ORDER_STATUS_FILTER_OPTIONS,
  type InviteeOrderStatusFilterValue,
} from "@/lib/invitee-order-status-filter";

type EventInviteesTableToolbarProps = {
  ctx: AdminDataTableContext<EventInviteeListRow>;
  orderStatusFilter: InviteeOrderStatusFilterValue;
  onOrderStatusFilterChange: (value: InviteeOrderStatusFilterValue) => void;
};

export function EventInviteesTableToolbar({
  ctx,
  orderStatusFilter,
  onOrderStatusFilterChange,
}: EventInviteesTableToolbarProps) {
  return (
    <label
      className="flex items-center gap-2 text-sm"
      htmlFor="event-invitees-order-status"
    >
      <span className="whitespace-nowrap text-muted-foreground">
        Order status
      </span>
      <Select
        autoComplete="off"
        className="w-[180px]"
        id="event-invitees-order-status"
        name="event-invitees-order-status"
        value={orderStatusFilter}
        onChange={(e) => {
          const value = e.target.value as InviteeOrderStatusFilterValue;

          onOrderStatusFilterChange(value);
          ctx.setFilters({
            orderStatus: value || undefined,
          });
        }}
      >
        {INVITEE_ORDER_STATUS_FILTER_OPTIONS.map((opt) => (
          <option key={opt.value || "all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
    </label>
  );
}
