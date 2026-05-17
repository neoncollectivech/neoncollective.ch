import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api, type ListResponse } from "@/lib/api-client";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  personNeedsVerification,
  personVerificationSummary,
} from "@/lib/person-verification";
import { adminKeys } from "@/lib/query-keys";
import { isUuid } from "@/lib/uuid";

type PersonRow = {
  id: string;
  givenName: string;
  familyName: string;
  email: string | null;
  phone: string | null;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
};

export function PeoplePage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: adminKeys.people.list({ q: search }),
    queryFn: async () => {
      const res = await api.get<ListResponse<PersonRow>>("/admin/people", {
        params: {
          ...(search ? { q: search } : {}),
          pageSize: "100",
        },
      });
      return res.data;
    },
  });

  const items = data?.items ?? [];

  const selectableIds = useMemo(
    () => items.filter((p) => isUuid(p.id) && personNeedsVerification(p)).map((p) => p.id),
    [items],
  );

  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const verifyMutation = useMutation({
    mutationFn: async (personIds: string[]) => {
      const res = await api.post<{
        meta: { updated: number; skipped: number; notFound: number };
      }>("/admin/people/verify", { personIds });
      return res.data.meta;
    },
    onSuccess: (meta) => {
      const parts: string[] = [];
      if (meta.updated > 0) parts.push(`${meta.updated} verified`);
      if (meta.skipped > 0) parts.push(`${meta.skipped} skipped`);
      if (meta.notFound > 0) parts.push(`${meta.notFound} not found`);
      toast.success(parts.length > 0 ? parts.join(", ") : "No changes");
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: adminKeys.people.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, "Verification failed")),
  });

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
          variant="outline"
          disabled={selectedIds.length === 0 || verifyMutation.isPending}
          onClick={() => verifyMutation.mutate(selectedIds)}
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
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={allSelectableSelected}
                  disabled={selectableIds.length === 0}
                  aria-label="Select all needing verification"
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
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={selected.has(p.id)}
                      disabled={!canSelect}
                      aria-label={`Select ${p.givenName} ${p.familyName}`}
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
                      <Button variant="ghost" size="sm" asChild>
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
