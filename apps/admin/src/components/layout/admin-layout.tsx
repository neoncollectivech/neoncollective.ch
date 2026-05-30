import type { CSSProperties } from "react";

import { Outlet } from "react-router-dom";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const sidebarWidthStyle = {
  "--sidebar-width": "14rem",
  "--sidebar-width-mobile": "14rem",
} as CSSProperties;

export function AdminLayout() {
  return (
    <SidebarProvider style={sidebarWidthStyle}>
      <AdminSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
