import { Link } from "react-router-dom";

import { AdminDataTable } from "@/components/admin-data-table";
import { eventsColumns } from "@/components/admin-data-table/columns/events-columns";
import { Button } from "@/components/ui/button";
import { eventsListService } from "@/lib/admin-list-services";

const columns = eventsColumns();

export function EventsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Events</h2>
        <Button asChild>
          <Link to="/events/new">New event</Link>
        </Button>
      </div>
      <AdminDataTable columns={columns} service={eventsListService} />
    </div>
  );
}
