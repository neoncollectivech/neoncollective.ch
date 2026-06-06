import type {
  AdmissionRow,
  EventInviteeListRow,
  EventRow,
  InviteLinkRow,
  InviteRedemptionRow,
  OrderRow,
} from "@/lib/admin-api";

import { Link } from "react-router-dom";
import { toast } from "sonner";

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
import { eventFkService, personFkService } from "@/lib/admin-fk-services";
import {
  eventAdmissionPath,
  eventOrderPath,
  eventOverviewPath,
  eventWorkspaceSectionPath,
} from "@/lib/event-workspace-paths";
import { buildPublicInviteUrl } from "@/lib/invite-url";
import { isUuid } from "@/lib/uuid";

function EmptyRow({ message }: { message: string }) {
  return <p className="text-sm text-muted-foreground">{message}</p>;
}

type PersonOrdersTableProps = {
  orders: OrderRow[];
};

export function PersonOrdersTable({ orders }: PersonOrdersTableProps) {
  const fk = useForeignKey({ rows: orders, load: [eventFkService] });
  const sort = useClientTableSort(orders, { defaultField: "createdAt" });

  if (orders.length === 0) {
    return <EmptyRow message="No orders." />;
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
          <AdminSortableTableHead
            field="createdAt"
            label="Created"
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
            <TableCell className="text-muted-foreground">
              {new Date(order.createdAt).toLocaleString()}
            </TableCell>
            <TableCell>
              {isUuid(order.id) ? (
                <Button asChild size="sm" variant="ghost">
                  <Link to={eventOrderPath(order.eventId, order.id)}>View</Link>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type PersonAdmissionsTableProps = {
  admissions: AdmissionRow[];
};

export function PersonAdmissionsTable({
  admissions,
}: PersonAdmissionsTableProps) {
  const fk = useForeignKey({ rows: admissions, load: [eventFkService] });
  const sort = useClientTableSort(admissions, { defaultField: "createdAt" });

  if (admissions.length === 0) {
    return <EmptyRow message="No admissions." />;
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
            field="checkedInAt"
            label="Check-in"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <AdminSortableTableHead
            field="createdAt"
            label="Created"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sort.rows.map((admission) => (
          <TableRow key={admission.id}>
            <TableCell>
              <AdminFkCell
                fk={fk}
                fkService={eventFkService}
                foreignDisplayField="title"
                foreignId={admission.eventId}
              />
            </TableCell>
            <TableCell>
              {admission.revokedAt ? (
                <Badge variant="secondary">Revoked</Badge>
              ) : admission.checkedInAt ? (
                <Badge>Checked in</Badge>
              ) : (
                <Badge variant="outline">Not checked in</Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(admission.createdAt).toLocaleString()}
            </TableCell>
            <TableCell>
              {isUuid(admission.id) ? (
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to={eventAdmissionPath(admission.eventId, admission.id)}
                  >
                    View
                  </Link>
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
  "id" | "eventId" | "personId" | "inviterId" | "revokedAt" | "createdAt"
>;

type PersonInviteesTableProps = {
  invitees: PersonInviteeRow[];
};

export function PersonInviteesTable({ invitees }: PersonInviteesTableProps) {
  const fk = useForeignKey({ rows: invitees, load: [eventFkService] });
  const sort = useClientTableSort(invitees, {
    defaultField: "createdAt",
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
    return <EmptyRow message="No event invites." />;
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
          <AdminSortableTableHead
            field="createdAt"
            label="Created"
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
            <TableCell className="text-muted-foreground">
              {new Date(invitee.createdAt).toLocaleString()}
            </TableCell>
            <TableCell>
              {isUuid(invitee.eventId) ? (
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to={eventWorkspaceSectionPath(invitee.eventId, "invitees")}
                  >
                    Event invites
                  </Link>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type PersonHostedInviteesTableProps = {
  invitees: PersonInviteeRow[];
};

export function PersonHostedInviteesTable({
  invitees,
}: PersonHostedInviteesTableProps) {
  const fk = useForeignKey({
    rows: invitees,
    load: [eventFkService, personFkService],
  });
  const sort = useClientTableSort(invitees, {
    defaultField: "createdAt",
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
    return <EmptyRow message="No guests invited yet." />;
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
            field="personId"
            label="Guest"
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
              {invitee.personId ? (
                <AdminFkCell
                  fk={fk}
                  fkService={personFkService}
                  foreignDisplayField={["givenName", "familyName"]}
                  foreignId={invitee.personId}
                />
              ) : (
                <span className="text-muted-foreground">Unlinked</span>
              )}
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
                  <Link to={eventOverviewPath(invitee.eventId)}>Event</Link>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type PersonInviteLinksTableProps = {
  links: InviteLinkRow[];
};

export function PersonInviteLinksTable({ links }: PersonInviteLinksTableProps) {
  const fk = useForeignKey({ rows: links, load: [eventFkService] });
  const sort = useClientTableSort(links, { defaultField: "createdAt" });

  if (links.length === 0) {
    return <EmptyRow message="No guest invite links." />;
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
            className="text-right"
            field="maxRedemptions"
            label="Max redemptions"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <AdminSortableTableHead
            field="createdAt"
            label="Created"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sort.rows.map((link) => {
          const event = fk.lookups.event?.get(link.eventId) as
            | EventRow
            | undefined;
          const slug = event?.slug ?? null;

          return (
            <TableRow key={link.id}>
              <TableCell>
                <AdminFkCell
                  fk={fk}
                  fkService={eventFkService}
                  foreignDisplayField="title"
                  foreignId={link.eventId}
                />
              </TableCell>
              <TableCell className="text-right">{link.maxRedemptions}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(link.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>
                {slug ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        buildPublicInviteUrl(slug, link.token),
                      );
                      toast.success("Invite link copied");
                    }}
                  >
                    Copy link
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

type PersonInviteRedemptionRow = InviteRedemptionRow & {
  eventId: string;
};

type PersonInviteRedemptionsTableProps = {
  redemptions: PersonInviteRedemptionRow[];
};

export function PersonInviteRedemptionsTable({
  redemptions,
}: PersonInviteRedemptionsTableProps) {
  const fk = useForeignKey({ rows: redemptions, load: [eventFkService] });
  const sort = useClientTableSort(redemptions, { defaultField: "createdAt" });

  if (redemptions.length === 0) {
    return <EmptyRow message="No invite link redemptions on this person's orders." />;
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
            field="orderId"
            label="Order"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <AdminSortableTableHead
            field="createdAt"
            label="Redeemed"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sort.rows.map((redemption) => (
          <TableRow key={redemption.id}>
            <TableCell>
              <AdminFkCell
                fk={fk}
                fkService={eventFkService}
                foreignDisplayField="title"
                foreignId={redemption.eventId}
              />
            </TableCell>
            <TableCell className="font-mono text-xs">
              {redemption.orderId.slice(0, 8)}…
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(redemption.createdAt).toLocaleString()}
            </TableCell>
            <TableCell>
              {isUuid(redemption.orderId) ? (
                <Button asChild size="sm" variant="ghost">
                  <Link
                    to={eventOrderPath(redemption.eventId, redemption.orderId)}
                  >
                    View order
                  </Link>
                </Button>
              ) : null}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
