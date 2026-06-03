import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { doorApi } from "@/hooks/use-door-api";

export function OutboxBadge() {
  const { data: pending = 0 } = useQuery(doorApi.outbox.stats());

  if (pending <= 0) {
    return null;
  }

  return (
    <Link className="inline-flex" to="/queue">
      <Badge variant="default">{pending} queued</Badge>
    </Link>
  );
}
