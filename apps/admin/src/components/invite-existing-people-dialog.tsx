import type { PersonRow } from "@/lib/admin-api";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InlineSpinner } from "@/components/ui/inline-spinner";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/hooks/use-admin-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { limitSkipToPage, listRangeLabel } from "@/lib/admin-list";
import { peopleListService } from "@/lib/admin-list-services";
import {
  canInvitePerson,
  personToInviteePayload,
} from "@/lib/person-invitee";

const SEARCH_PAGE_SIZE = 25;
const MIN_SEARCH_LENGTH = 2;

type InviteExistingPeopleDialogProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function getPersonRowId(person: PersonRow) {
  return person.id;
}

export function InviteExistingPeopleDialog({
  eventId,
  open,
  onOpenChange,
}: InviteExistingPeopleDialogProps) {
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPeople, setSelectedPeople] = useState<Map<string, PersonRow>>(
    () => new Map(),
  );

  const upsertMutation = useMutation(adminApi.event.upsertInvitees(eventId));

  const listQuery = useQuery({
    ...peopleListService.listQuery({
      page,
      pageSize: SEARCH_PAGE_SIZE,
      sort: "givenName",
      filters: { q: activeQuery },
    }),
    enabled: open && activeQuery.trim().length >= MIN_SEARCH_LENGTH,
  });

  const people = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const pagination = meta ? limitSkipToPage(meta) : null;

  const selectableOnPage = useMemo(
    () => people.filter(canInvitePerson),
    [people],
  );

  const selectedIds = useMemo(
    () => [...selectedPeople.keys()],
    [selectedPeople],
  );
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allSelectableOnPageSelected =
    selectableOnPage.length > 0 &&
    selectableOnPage.every((p) => selectedSet.has(p.id));

  useEffect(() => {
    if (!open) {
      setSearchInput("");
      setActiveQuery("");
      setPage(1);
      setSelectedPeople(new Map());
    }
  }, [open]);

  useEffect(() => {
    setPage(1);
    setSelectedPeople(new Map());
  }, [activeQuery]);

  const runSearch = () => {
    const q = searchInput.trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      toast.error(`Enter at least ${MIN_SEARCH_LENGTH} characters to search.`);
      return;
    }
    setActiveQuery(q);
  };

  const toggleRow = (person: PersonRow) => {
    setSelectedPeople((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) {
        next.delete(person.id);
      } else {
        next.set(person.id, person);
      }
      return next;
    });
  };

  const toggleAllOnPage = () => {
    if (allSelectableOnPageSelected) {
      setSelectedPeople((prev) => {
        const next = new Map(prev);
        for (const person of selectableOnPage) {
          next.delete(getPersonRowId(person));
        }
        return next;
      });
      return;
    }
    setSelectedPeople((prev) => {
      const next = new Map(prev);
      for (const person of selectableOnPage) {
        next.set(person.id, person);
      }
      return next;
    });
  };

  const inviteSelected = () => {
    const payloads = [...selectedPeople.values()]
      .map(personToInviteePayload)
      .filter((p): p is NonNullable<typeof p> => p != null);

    if (payloads.length === 0) {
      toast.error("Selected people need an email or phone on file.");
      return;
    }

    upsertMutation.mutate(payloads, {
      onSuccess: (result) => {
        const parts: string[] = [];
        if (result.created > 0) parts.push(`${result.created} invited`);
        if (result.skipped > 0) parts.push(`${result.skipped} already on list`);
        if (result.invalid > 0) parts.push(`${result.invalid} invalid`);
        toast.success(parts.length > 0 ? parts.join(", ") : "No changes");
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err, "Failed to invite"));
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Add invitee</DialogTitle>
          <DialogDescription>
            Search people in the directory, select who to invite, then confirm.
            Each person needs an email or phone on file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Input
            autoComplete="off"
            className="min-w-[200px] flex-1"
            id="invite-people-search"
            name="invite-people-search"
            placeholder="Search name, email, phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                runSearch();
              }
            }}
          />
          <Button type="button" onClick={runSearch}>
            Search
          </Button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-auto rounded-md border border-border">
          {activeQuery.trim().length < MIN_SEARCH_LENGTH ? (
            <p className="p-4 text-sm text-muted-foreground">
              Search to find people to invite.
            </p>
          ) : listQuery.isLoading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <InlineSpinner />
              Searching…
            </p>
          ) : listQuery.isError ? (
            <p className="p-4 text-sm text-red-400">Search failed.</p>
          ) : people.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No people found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      aria-label="Select all inviteable people on this page"
                      checked={allSelectableOnPageSelected}
                      className="size-4 rounded border-input"
                      disabled={selectableOnPage.length === 0}
                      type="checkbox"
                      onChange={toggleAllOnPage}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {people.map((person) => {
                  const inviteable = canInvitePerson(person);
                  const checkboxId = `invite-person-${person.id}`;

                  return (
                    <TableRow key={person.id}>
                      <TableCell className="w-10">
                        <input
                          aria-label={`Select ${person.givenName} ${person.familyName}`}
                          checked={selectedSet.has(person.id)}
                          className="size-4 rounded border-input"
                          disabled={!inviteable}
                          id={checkboxId}
                          type="checkbox"
                          onChange={() => toggleRow(person)}
                        />
                      </TableCell>
                      <TableCell>
                        {person.givenName} {person.familyName}
                        {!inviteable ? (
                          <p className="text-xs text-muted-foreground">
                            No email or phone
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>{person.email ?? "—"}</TableCell>
                      <TableCell>
                        {person.phone ? `+${person.phone}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {meta && meta.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span>{listRangeLabel(meta)}</span>
            {pagination && pagination.totalPages > 1 ? (
              <div className="flex gap-2">
                <Button
                  disabled={page <= 1 || listQuery.isFetching}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  disabled={
                    page >= pagination.totalPages || listQuery.isFetching
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setPage((p) => Math.min(pagination.totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={selectedIds.length === 0 || upsertMutation.isPending}
            type="button"
            onClick={inviteSelected}
          >
            {upsertMutation.isPending
              ? "Inviting…"
              : `Invite selected (${selectedIds.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
