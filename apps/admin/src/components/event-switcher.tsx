import type { EventRow } from "@/lib/admin-api";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { eventsListService } from "@/lib/admin-list-services";
import {
  pathAfterEventSwitch,
  readRecentEventIds,
  workspaceSuffixFromPathname,
} from "@/lib/event-workspace-paths";
import { cn } from "@/lib/utils";

type EventSwitcherProps = {
  currentEventId: string;
  currentTitle?: string;
  className?: string;
};

function filterEvents(events: EventRow[], query: string): EventRow[] {
  const q = query.trim().toLowerCase();

  if (!q) {
    return events;
  }

  return events.filter(
    (event) =>
      event.title.toLowerCase().includes(q) ||
      event.slug.toLowerCase().includes(q),
  );
}

function EventPickerRow({
  event,
  isCurrent,
  onSelect,
}: {
  event: EventRow;
  isCurrent?: boolean;
  onSelect: (eventId: string) => void;
}) {
  return (
    <Button
      className={cn(
        "flex h-auto w-full items-center px-3 py-2 text-left text-sm font-normal",
        isCurrent && "bg-muted",
      )}
      type="button"
      variant="ghost"
      onClick={() => onSelect(event.id)}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{event.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {event.slug}
        </span>
      </span>
    </Button>
  );
}

export function EventSwitcher({
  currentEventId,
  currentTitle,
  className,
}: EventSwitcherProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const listQuery = useQuery(
    eventsListService.listQuery({
      page: 1,
      pageSize: 100,
      sort: "title",
    }),
  );

  const allEvents = listQuery.data?.items ?? [];
  const recentIds = readRecentEventIds();
  const recentEvents = useMemo(
    () =>
      recentIds
        .map((id) => allEvents.find((event) => event.id === id))
        .filter((event): event is EventRow => event != null),
    [allEvents, recentIds],
  );

  const filtered = useMemo(
    () => filterEvents(allEvents, search),
    [allEvents, search],
  );

  function selectEvent(nextEventId: string) {
    const suffix = workspaceSuffixFromPathname(pathname);

    navigate(pathAfterEventSwitch(nextEventId, suffix));
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <Button
        className={cn("max-w-md justify-between gap-2", className)}
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{currentTitle ?? "Select event"}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-hidden sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch event</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search by title or slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div
            className={cn(
              "max-h-[50vh] overflow-y-auto space-y-4",
              listQuery.isLoading && "opacity-60",
            )}
          >
            {recentEvents.length > 0 && !search.trim() ? (
              <div>
                <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent
                </p>
                <div className="space-y-0.5">
                  {recentEvents.map((event) => (
                    <EventPickerRow
                      key={event.id}
                      event={event}
                      isCurrent={event.id === currentEventId}
                      onSelect={selectEvent}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {search.trim() ? "Results" : "All events"}
              </p>
              {filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No events found.
                </p>
              ) : (
                <div className="space-y-0.5">
                  {filtered.map((event) => (
                    <EventPickerRow
                      key={event.id}
                      event={event}
                      isCurrent={event.id === currentEventId}
                      onSelect={selectEvent}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
