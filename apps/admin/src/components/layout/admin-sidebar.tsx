import { ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { EventSwitcher } from "@/components/event-switcher";
import { AdminBrand } from "@/components/layout/admin-brand";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAdminSidebarModel } from "@/hooks/use-admin-sidebar-model";
import {
  devAdminDisplayEmail,
  isAdminAuthDisabled,
} from "@/lib/admin-auth-dev";
import { signOut, useSession } from "@/lib/auth-client";

export function AdminSidebar() {
  const { pathname } = useLocation();
  const { data: session } = useSession();
  const model = useAdminSidebarModel();
  const devBypass = isAdminAuthDisabled();
  const displayEmail = devBypass ? devAdminDisplayEmail() : session?.user.email;

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <AdminBrand />
      </SidebarHeader>

      <SidebarContent>
        {model.back ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to={model.back.href}>
                      <ArrowLeft />
                      <span>{model.back.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {model.mode === "event" && model.eventId ? (
          <SidebarGroup>
            <SidebarGroupLabel>Event</SidebarGroupLabel>
            <SidebarGroupContent>
              <EventSwitcher
                className="w-full max-w-none justify-between gap-2"
                currentEventId={model.eventId}
                currentTitle={model.eventTitle}
              />
              {model.isEventLoading ? (
                <p className="px-2 text-xs text-muted-foreground">
                  Loading event…
                </p>
              ) : null}
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {model.links.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild isActive={item.isActive(pathname)}>
                    <Link to={item.href}>{item.label}</Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <p className="truncate px-2 text-xs text-muted-foreground">
          {displayEmail}
          {devBypass ? " (dev bypass)" : null}
        </p>
        {devBypass ? null : (
          <Button
            className="w-full"
            size="sm"
            variant="outline"
            onClick={() => signOut()}
          >
            Sign out
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
