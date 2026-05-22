import type { PersonRow } from "@/lib/admin-api";

import { useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AdminDataTable } from "@/components/admin-data-table";
import { peopleColumns } from "@/components/admin-data-table/columns/people-columns";
import { PeopleTableToolbar } from "@/components/people-table-toolbar";
import { adminApi } from "@/hooks/use-admin-api";
import { peopleListService } from "@/lib/admin-list-services";
import { personNeedsVerification } from "@/lib/person-verification";
import { isUuid } from "@/lib/uuid";

const columns = peopleColumns();

function getPersonRowId(person: PersonRow) {
  return person.id;
}

function isPersonRowSelectable(person: PersonRow) {
  return isUuid(person.id) && personNeedsVerification(person);
}

export function PeoplePage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const verifyMutation = useMutation(adminApi.people.verify());

  const rowSelection = useMemo(
    () => ({
      getRowId: getPersonRowId,
      isRowSelectable: isPersonRowSelectable,
      selectedIds,
      onSelectedIdsChange: setSelectedIds,
    }),
    [selectedIds],
  );

  const handleVerify = (personIds: string[]) => {
    verifyMutation.mutate(personIds, {
      onSuccess: (meta) => {
        const parts: string[] = [];

        if (meta.updated > 0) parts.push(`${meta.updated} verified`);
        if (meta.skipped > 0) parts.push(`${meta.skipped} skipped`);
        if (meta.notFound > 0) parts.push(`${meta.notFound} not found`);
        toast.success(parts.length > 0 ? parts.join(", ") : "No changes");
        setSelectedIds([]);
      },
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">People</h2>
      <AdminDataTable
        columns={columns}
        rowSelection={rowSelection}
        service={peopleListService}
        toolbar={(ctx) => (
          <PeopleTableToolbar
            ctx={ctx}
            isVerifying={verifyMutation.isPending}
            onVerify={handleVerify}
          />
        )}
      />
    </div>
  );
}
