import type { EventInviteeListRow, OrderRow } from "@/lib/admin-api";

import { Link } from "react-router-dom";

import { AdminSortableTableHead } from "@/components/admin-sortable-table-head";
import { AdminFkCell } from "@/components/admin-fk/admin-fk-cell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useForeignKey } from "@/hooks/use-foreign-key";
import { useClientTableSort } from "@/hooks/use-client-table-sort";
import { eventFkService } from "@/lib/admin-fk-services";
import { isUuid } from "@/lib/uuid";

type PersonOrdersTableProps = {
  orders: OrderRow[];
};

export function PersonOrdersTable({ orders }: PersonOrdersTableProps) {
  const fk = useForeignKey({ rows: orders, load: [eventFkService] });
  const sort = useClientTableSort(orders, { defaultField: "createdAt" });

  if (orders.length === 0) {
    return <p className="text-sm text-muted-foreground">No orders.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <AdminSortableTableHead
            field="eventId"
            label="Event"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <AdminSortableTableHead
            field="amountCents"
            label="Amount"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <AdminSortableTableHead
            field="status"
            label="Status"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sort.rows.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <AdminFkCell
                fk={fk}
                fkService={eventFkService}
                foreignDisplayField="title"
                foreignId={order.eventId}
              />
            </TableCell>
            <TableCell>CHF {(order.amountCents / 100).toFixed(2)}</TableCell>
            <TableCell>
              <Badge>{order.status}</Badge>
            </TableCell>
            <TableCell>
              {isUuid(order.id) ? (
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/orders/${order.id}`}>View</Link>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type PersonInviteeRow = Pick<
  EventInviteeListRow,
  "id" | "eventId" | "revokedAt"
>;

type PersonInviteesTableProps = {
  invitees: PersonInviteeRow[];
};

export function PersonInviteesTable({ invitees }: PersonInviteesTableProps) {
  const fk = useForeignKey({ rows: invitees, load: [eventFkService] });
  const sort = useClientTableSort(invitees, {
    defaultField: "eventId",
    getValue: (row, field) => {
      if (field === "status") {
        return row.revokedAt ? "revoked" : "active";
      }

      return (row as Record<string, unknown>)[field] as
        | string
        | null
        | undefined;
    },
  });

  if (invitees.length === 0) {
    return <p className="text-sm text-muted-foreground">No invitees.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <AdminSortableTableHead
            field="eventId"
            label="Event"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <AdminSortableTableHead
            field="status"
            label="Status"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sort.rows.map((invitee) => (
          <TableRow key={invitee.id}>
            <TableCell>
              <AdminFkCell
                fk={fk}
                fkService={eventFkService}
                foreignDisplayField="title"
                foreignId={invitee.eventId}
              />
            </TableCell>
            <TableCell>
              {invitee.revokedAt ? (
                <Badge variant="secondary">Revoked</Badge>
              ) : (
                <Badge>Active</Badge>
              )}
            </TableCell>
            <TableCell>
              {isUuid(invitee.eventId) ? (
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/events/${invitee.eventId}`}>Event</Link>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
