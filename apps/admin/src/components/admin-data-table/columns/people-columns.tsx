import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { PersonRow } from "@/lib/admin-api";

import { toast } from "sonner";

import {
  adminActionsColumn,
  adminLinkColumn,
  adminSelectionColumn,
  adminTextColumn,
} from "@/components/admin-data-table/column-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildPublicLoginUrl, personLoginContact } from "@/lib/invite-url";
import { personNeedsVerification } from "@/lib/person-verification";
import { isUuid } from "@/lib/uuid";

async function copyPersonLoginLink(person: {
  email: string | null;
  phone: string | null;
}) {
  const contact = personLoginContact(person);

  if (!contact) {
    toast.error("No email or phone on file");

    return;
  }
  await navigator.clipboard.writeText(buildPublicLoginUrl(contact));
  toast.success("Login link copied");
}

export function peopleColumns(): AdminColumnDef<PersonRow>[] {
  return [
    adminSelectionColumn({ idPrefix: "people-row" }),
    adminLinkColumn({
      id: "name",
      accessorKey: "givenName",
      header: "Name",
      sortable: true,
      className: "font-medium",
      getLabel: (person) =>
        `${person.givenName} ${person.familyName}`.trim() ||
        person.id.slice(0, 8),
      getHref: (person) =>
        isUuid(person.id) ? `/people/${person.id}` : undefined,
    }),
    adminTextColumn("email", { header: "Email", sortable: true }),
    {
      id: "phone",
      accessorKey: "phone",
      header: "Phone",
      enableSorting: true,
      meta: { sortable: true },
      cell: ({ row }) => (row.original.phone ? `+${row.original.phone}` : "—"),
    },
    {
      id: "verification",
      header: "Verification",
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        const verified =
          !personNeedsVerification(p) &&
          Boolean(p.email?.trim() || p.phone?.trim());

        return verified ? (
          <Badge>Verified</Badge>
        ) : personNeedsVerification(p) ? (
          <Badge variant="secondary">Pending</Badge>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    adminActionsColumn({
      cell: ({ row }) => {
        const p = row.original;
        const loginContact = personLoginContact(p);

        if (!loginContact) {
          return "—";
        }

        return (
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copyPersonLoginLink(p)}
          >
            Copy login link
          </Button>
        );
      },
    }),
  ];
}
