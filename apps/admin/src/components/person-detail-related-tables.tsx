import type {
  AdmissionRow,
  EventInviteeListRow,
  EventRegistrationRow,
  EventRow,
  InviteLinkRow,
  InviteRedemptionRow,
  OrderRow,
} from "@/lib/admin-api";

import { toast } from "sonner";

import { AdminDetailLink } from "@/components/admin-data-table/column-helpers";
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
            field="orderKind"
            label="Kind"
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
                href={() =>
                  isUuid(order.id)
                    ? eventOrderPath(order.eventId, order.id)
                    : undefined
                }
              />
            </TableCell>
            <TableCell>CHF {(order.amountCents / 100).toFixed(2)}</TableCell>
            <TableCell>
              <Badge>{order.status}</Badge>
            </TableCell>
            <TableCell>
              <Badge
                variant={order.orderKind === "upsell" ? "secondary" : "default"}
              >
                {order.orderKind}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(order.createdAt).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type PersonRegistrationsTableProps = {
  registrations: EventRegistrationRow[];
};

export function PersonRegistrationsTable({
  registrations,
}: PersonRegistrationsTableProps) {
  const fk = useForeignKey({ rows: registrations, load: [eventFkService] });
  const sort = useClientTableSort(registrations, {
    defaultField: "confirmedAt",
  });

  if (registrations.length === 0) {
    return <EmptyRow message="No event registrations." />;
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
            field="confirmedAt"
            label="Confirmed"
            sortDirection={sort.sortDirection}
            sortField={sort.sortField}
            onSort={sort.toggleSort}
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sort.rows.map((registration) => (
          <TableRow key={registration.id}>
            <TableCell>
              <AdminFkCell
                fk={fk}
                fkService={eventFkService}
                foreignDisplayField="title"
                foreignId={registration.eventId}
                href={() =>
                  isUuid(registration.primaryOrderId)
                    ? eventOrderPath(
                        registration.eventId,
                        registration.primaryOrderId,
                      )
                    : undefined
                }
              />
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  registration.status === "refunded" ? "secondary" : "default"
                }
              >
                {registration.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(registration.confirmedAt).toLocaleString()}
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
                href={() =>
                  isUuid(admission.id)
                    ? eventAdmissionPath(admission.eventId, admission.id)
                    : undefined
                }
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
                href={() =>
                  isUuid(invitee.eventId)
                    ? eventWorkspaceSectionPath(invitee.eventId, "invitees")
                    : undefined
                }
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
                href={() =>
                  isUuid(invitee.eventId)
                    ? eventOverviewPath(invitee.eventId)
                    : undefined
                }
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
              <TableCell className="text-right">
                {link.maxRedemptions}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(link.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>
                {slug ? (
                  <Button
                    disabled={!link.token}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!link.token) {
                        return;
                      }
                      void (async () => {
                        try {
                          await navigator.clipboard.writeText(
                            buildPublicInviteUrl(slug, link.token!),
                          );
                          toast.success("Invite link copied");
                        } catch {
                          toast.error("Could not copy invite link");
                        }
                      })();
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
    return (
      <EmptyRow message="No invite link redemptions on this person's orders." />
    );
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
              {isUuid(redemption.orderId) ? (
                <AdminDetailLink
                  href={eventOrderPath(redemption.eventId, redemption.orderId)}
                >
                  {redemption.orderId.slice(0, 8)}…
                </AdminDetailLink>
              ) : (
                redemption.orderId.slice(0, 8)
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(redemption.createdAt).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
