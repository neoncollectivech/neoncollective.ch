import { Link, useLocation } from "react-router-dom";

import { EventSwitcher } from "@/components/event-switcher";
import { AdminBrand } from "@/components/layout/admin-brand";
import { PwaUpdateActions } from "@/components/pwa-update-actions";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
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
import {
  useAdminSidebarModel,
  type AdminNavSection,
} from "@/hooks/use-admin-sidebar-model";
import {
  devAdminDisplayEmail,
  isAdminAuthDisabled,
} from "@/lib/admin-auth-dev";
import { signOut, useSession } from "@/lib/auth-client";

function SidebarNavSections({
  sections,
  pathname,
}: {
  sections: AdminNavSection[];
  pathname: string;
}) {
  return (
    <>
      {sections.map((section) => (
        <SidebarGroup key={section.id}>
          <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {section.links.map((item) => {
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.key}>
                    <SidebarMenuButton
                      asChild
                      isActive={item.isActive(pathname)}
                    >
                      <Link to={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

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

        <SidebarNavSections pathname={pathname} sections={model.sections} />

        {model.secondarySections && model.secondarySections.length > 0 ? (
          <>
            <Separator className="my-2" />
            <SidebarNavSections
              pathname={pathname}
              sections={model.secondarySections}
            />
          </>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <PwaUpdateActions />
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
