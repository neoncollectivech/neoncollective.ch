import type { AdminSidebarModel } from "@/hooks/use-admin-sidebar-model";

import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { EventSwitcher } from "@/components/event-switcher";
import { AdminNavList } from "@/components/layout/admin-nav-list";
import { Button } from "@/components/ui/button";

type AdminSidebarBodyProps = {
  model: AdminSidebarModel;
};

export function AdminSidebarBody({ model }: AdminSidebarBodyProps) {
  return (
    <div className="flex flex-col gap-4 flex-1 min-h-0">
      {model.back ? (
        <Button
          asChild
          className="justify-start px-3"
          size="sm"
          variant="ghost"
        >
          <Link to={model.back.href}>
            <ArrowLeft className="mr-2 h-4 w-4 shrink-0" />
            {model.back.label}
          </Link>
        </Button>
      ) : null}

      {model.mode === "event" && model.eventId ? (
        <div className="space-y-2">
          <EventSwitcher
            className="w-full max-w-none justify-between gap-2"
            currentEventId={model.eventId}
            currentStatus={model.eventStatus}
            currentTitle={model.eventTitle}
          />
          {model.isEventLoading ? (
            <p className="px-3 text-xs text-muted-foreground">Loading event…</p>
          ) : null}
        </div>
      ) : null}

      <AdminNavList links={model.links} />
    </div>
  );
}
