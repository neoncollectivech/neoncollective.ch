import type { PosPersonSearchRow } from "@/lib/pos-api";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { posApi } from "@/hooks/use-pos-api/api";

const MIN_SEARCH_LENGTH = 2;

type GuestPeopleSearchProps = {
  disabled?: boolean;
  onSelect: (person: PosPersonSearchRow) => void;
};

function formatPersonContact(person: PosPersonSearchRow): string | null {
  if (person.email) {
    return person.email;
  }
  if (person.phone) {
    return person.phone.startsWith("+") ? person.phone : `+${person.phone}`;
  }

  return null;
}

export function GuestPeopleSearch({
  disabled,
  onSelect,
}: GuestPeopleSearchProps) {
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState("");

  const searchQuery = useQuery({
    ...posApi.people.search(activeQuery),
    enabled: activeQuery.trim().length >= MIN_SEARCH_LENGTH && !disabled,
  });

  const runSearch = () => {
    const q = searchInput.trim();

    if (q.length < MIN_SEARCH_LENGTH) {
      toast.error(`Enter at least ${MIN_SEARCH_LENGTH} characters to search.`);

      return;
    }
    setActiveQuery(q);
  };

  const people = searchQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="pos-people-search">Search existing people</Label>
        <div className="flex gap-2">
          <Input
            autoComplete="off"
            disabled={disabled}
            id="pos-people-search"
            placeholder="Name, email, or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
          />
          <Button
            aria-label="Search people"
            className="size-10 shrink-0"
            disabled={disabled}
            size="icon"
            type="button"
            variant="outline"
            onClick={runSearch}
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {activeQuery.trim().length >= MIN_SEARCH_LENGTH ? (
        <div className="space-y-2">
          {searchQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Searching…</p>
          ) : null}
          {searchQuery.isError ? (
            <p className="text-destructive text-sm">Search failed.</p>
          ) : null}
          {!searchQuery.isLoading &&
          !searchQuery.isError &&
          people.length === 0 ? (
            <p className="text-muted-foreground text-sm">No people found.</p>
          ) : null}
          {people.map((person) => {
            const contact = formatPersonContact(person);
            const name = `${person.givenName} ${person.familyName}`.trim();

            return (
              <Button
                key={person.id}
                className="h-auto w-full justify-start px-3 py-2 text-left"
                disabled={disabled}
                type="button"
                variant="outline"
                onClick={() => onSelect(person)}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">
                    {name || person.id}
                  </span>
                  {contact ? (
                    <span className="text-muted-foreground truncate text-xs">
                      {contact}
                    </span>
                  ) : null}
                </span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
