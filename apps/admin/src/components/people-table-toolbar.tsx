import type { AdminDataTableContext } from "@/components/admin-data-table";
import type { PersonRow } from "@/lib/admin-api";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PeopleTableToolbarProps = {
  ctx: AdminDataTableContext<PersonRow>;
  onVerify: (personIds: string[]) => void;
  isVerifying: boolean;
};

export function PeopleTableToolbar({
  ctx,
  onVerify,
  isVerifying,
}: PeopleTableToolbarProps) {
  const [q, setQ] = useState("");

  const runSearch = () => {
    ctx.setFilters({ q: q.trim() || undefined });
  };

  return (
    <div className="flex flex-wrap gap-2 max-w-2xl">
      <Input
        autoComplete="off"
        className="min-w-[200px] flex-1"
        id="people-search"
        name="people-search"
        placeholder="Search name, email, phone…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            runSearch();
          }
        }}
      />
      <Button type="button" onClick={runSearch}>
        Search
      </Button>
      <Button
        disabled={ctx.selectedIds.length === 0 || isVerifying}
        type="button"
        variant="outline"
        onClick={() => onVerify(ctx.selectedIds)}
      >
        {isVerifying
          ? "Verifying…"
          : `Verify selected (${ctx.selectedIds.length})`}
      </Button>
    </div>
  );
}
