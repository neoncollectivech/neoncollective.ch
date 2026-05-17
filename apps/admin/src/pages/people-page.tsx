import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  personNeedsVerification,
  personVerificationSummary,
} from "@/lib/person-verification";
import { isUuid } from "@/lib/uuid";

export function PeoplePage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery(adminApi.people.list(search));

  const items = data?.items ?? [];

  const selectableIds = useMemo(
    () =>
      items
        .filter((p) => isUuid(p.id) && personNeedsVerification(p))
        .map((p) => p.id),
    [items],
  );

  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const verifyMutation = useMutation(adminApi.people.verify());

  const handleVerify = (personIds: string[]) => {
    verifyMutation.mutate(personIds, {
      onSuccess: (meta) => {
        const parts: string[] = [];

        if (meta.updated > 0) parts.push(`${meta.updated} verified`);
        if (meta.skipped > 0) parts.push(`${meta.skipped} skipped`);
        if (meta.notFound > 0) parts.push(`${meta.notFound} not found`);
        toast.success(parts.length > 0 ? parts.join(", ") : "No changes");
        setSelected(new Set());
      },
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  };

  const toggleAll = () => {
    if (allSelectableSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  };

  const selectedIds = [...selected];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-semibold">People</h2>
      <div className="flex flex-wrap gap-2 max-w-2xl">
        <Input
          className="flex-1 min-w-[200px]"
          placeholder="Search name, email, phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setSearch(q);
              setSelected(new Set());
              void refetch();
            }
          }}
        />
        <Button
          onClick={() => {
            setSearch(q);
            setSelected(new Set());
            void refetch();
          }}
        >
          Search
        </Button>
        <Button
          disabled={selectedIds.length === 0 || verifyMutation.isPending}
          variant="outline"
          onClick={() => handleVerify(selectedIds)}
        >
          {verifyMutation.isPending
            ? "Verifying…"
            : `Verify selected (${selectedIds.length})`}
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}

      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  aria-label="Select all needing verification"
                  checked={allSelectableSelected}
                  className="size-4 rounded border-input"
                  disabled={selectableIds.length === 0}
                  type="checkbox"
                  onChange={toggleAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Verification</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((p) => {
              const canSelect = isUuid(p.id) && personNeedsVerification(p);
              const verified =
                !personNeedsVerification(p) &&
                Boolean(p.email?.trim() || p.phone?.trim());

              return (
                <TableRow key={p.id}>
                  <TableCell>
                    <input
                      aria-label={`Select ${p.givenName} ${p.familyName}`}
                      checked={selected.has(p.id)}
                      className="size-4 rounded border-input"
                      disabled={!canSelect}
                      type="checkbox"
                      onChange={() => toggleOne(p.id)}
                    />
                  </TableCell>
                  <TableCell>
                    {p.givenName} {p.familyName}
                  </TableCell>
                  <TableCell>{p.email ?? "—"}</TableCell>
                  <TableCell>{p.phone ? `+${p.phone}` : "—"}</TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell>
                    {isUuid(p.id) ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/people/${p.id}`}>View</Link>
                      </Button>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
