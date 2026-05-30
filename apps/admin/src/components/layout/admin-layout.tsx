import { Outlet } from "react-router-dom";

import { AdminBrand } from "@/components/layout/admin-brand";
import { AdminSidebarBody } from "@/components/layout/admin-sidebar-body";
import { AdminSidebarFooter } from "@/components/layout/admin-sidebar-footer";
import { useAdminSidebarModel } from "@/hooks/use-admin-sidebar-model";
import { useSession } from "@/lib/auth-client";

export function AdminLayout() {
  const { data: session } = useSession();
  const model = useAdminSidebarModel();

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r border-border bg-card p-4 flex flex-col gap-6">
        <AdminBrand />
        <AdminSidebarBody model={model} />
        <AdminSidebarFooter email={session?.user.email} />
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
