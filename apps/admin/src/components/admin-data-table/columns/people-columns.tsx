import type { AdminColumnDef } from "@/components/admin-data-table/types";
import type { PersonRow } from "@/lib/admin-api";

import { Link } from "react-router-dom";
import { toast } from "sonner";

import { DataTableColumnHeader } from "@/components/admin-data-table/data-table-column-header";
import {
  adminActionsColumn,
  adminSelectionColumn,
  adminTextColumn,
} from "@/components/admin-data-table/column-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildPublicLoginUrl, personLoginContact } from "@/lib/invite-url";
import {
  personNeedsVerification,
  personVerificationSummary,
} from "@/lib/person-verification";
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
    adminSelectionColumn(),
    {
      id: "name",
      accessorKey: "givenName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Name" />
      ),
      enableSorting: true,
      meta: { sortable: true },
      cell: ({ row }) => (
        <span>
          {row.original.givenName} {row.original.familyName}
        </span>
      ),
    },
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

        return (
          <>
            {verified ? (
              <Badge>Verified</Badge>
            ) : personNeedsVerification(p) ? (
              <Badge variant="secondary">Pending</Badge>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {personVerificationSummary(p)}
            </p>
          </>
        );
      },
    },
    adminActionsColumn({
      cell: ({ row }) => {
        const p = row.original;
        const loginContact = personLoginContact(p);

        return (
          <div className="flex flex-wrap justify-end gap-1">
            {loginContact ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void copyPersonLoginLink(p)}
              >
                Copy login link
              </Button>
            ) : null}
            {isUuid(p.id) ? (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/people/${p.id}`}>View</Link>
              </Button>
            ) : null}
            {!loginContact && !isUuid(p.id) ? "—" : null}
          </div>
        );
      },
    }),
  ];
}
