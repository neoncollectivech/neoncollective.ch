import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { OutboxPanel } from "@/components/queue/OutboxPanel";

export function QueuePage() {
  return (
    <div className="door-scroll-page">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild size="icon" variant="ghost">
          <Link aria-label="Back to scanner" to="/">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Offline queue</h1>
      </div>
      <OutboxPanel />
    </div>
  );
}
