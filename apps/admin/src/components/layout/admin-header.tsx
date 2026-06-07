import { Fragment } from "react";
import { Link } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAdminBreadcrumbs } from "@/hooks/use-admin-breadcrumbs";

export function AdminHeader() {
  const segments = useAdminBreadcrumbs();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger />
      {segments.length > 0 ? (
        <Breadcrumb className="min-w-0 flex-1">
          <BreadcrumbList>
            {segments.map((segment, index) => {
              const isLast = index === segments.length - 1;

              return (
                <Fragment key={segment.key}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem className="max-w-[12rem] truncate sm:max-w-[16rem]">
                    {isLast || !segment.href ? (
                      <BreadcrumbPage title={segment.label}>
                        {segment.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild title={segment.label}>
                        <Link to={segment.href}>{segment.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
    </header>
  );
}
