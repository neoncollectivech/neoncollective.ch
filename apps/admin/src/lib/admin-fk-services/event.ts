import { listEvents } from "@/lib/admin-api";
import { eventOverviewPath } from "@/lib/event-workspace-paths";

import { createIdKeyedFkService } from "./create-id-keyed-fk-service";

export const eventFkService = createIdKeyedFkService({
  id: "event",
  defaultIdKey: "eventId",
  batchIdFromRow: (row) => row.eventId,
  list: listEvents,
  href: (id) => eventOverviewPath(id),
});
