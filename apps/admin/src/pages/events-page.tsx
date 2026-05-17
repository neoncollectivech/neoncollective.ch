import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

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
import { api, type ListResponse } from "@/lib/api-client";
import { adminKeys } from "@/lib/query-keys";
import { isUuid } from "@/lib/uuid";

type EventRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  accessMode: string;
  startsAt: string | null;
};

export function EventsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: adminKeys.events.list(),
    queryFn: async () => {
      const res = await api.get<ListResponse<EventRow>>("/admin/events");
      return res.data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Events</h2>
        <Button asChild>
          <Link to="/events/new">New event</Link>
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-red-400">Failed to load events.</p>}

      {data && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Access</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((event) => (
              <TableRow key={event.id ?? event.slug}>
                <TableCell className="font-medium">{event.title}</TableCell>
                <TableCell className="text-muted-foreground">{event.slug}</TableCell>
                <TableCell>
                  <Badge variant={event.status === "published" ? "default" : "secondary"}>
                    {event.status}
                  </Badge>
                </TableCell>
                <TableCell>{event.accessMode}</TableCell>
                <TableCell>
                  {isUuid(event.id) ? (
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/events/${event.id}`}>Open</Link>
                    </Button>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
