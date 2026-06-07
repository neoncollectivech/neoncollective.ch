import type { CSSProperties } from "react";

import { Outlet } from "react-router-dom";

import { AdminHeader } from "@/components/layout/admin-header";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

const sidebarWidthStyle = {
  "--sidebar-width": "14rem",
  "--sidebar-width-mobile": "14rem",
} as CSSProperties;

export function AdminLayout() {
  return (
    <SidebarProvider style={sidebarWidthStyle}>
      <AdminSidebar />
      <SidebarInset>
        <AdminHeader />
        <div className="flex-1 overflow-auto p-8">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
