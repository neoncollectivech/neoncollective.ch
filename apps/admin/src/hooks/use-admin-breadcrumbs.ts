import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { adminApi } from "@/hooks/use-admin-api";
import {
  buildAdminBreadcrumbs,
  type AdminBreadcrumbSegment,
} from "@/lib/admin-breadcrumbs";
import { parseEventWorkspaceEventId } from "@/lib/event-workspace-paths";
import { isUuid } from "@/lib/uuid";

function parsePersonId(pathname: string): string {
  const match = pathname.match(/^\/people\/([^/]+)$/);
  const id = match?.[1] ?? "";

  return isUuid(id) ? id : "";
}

function parseAdmissionId(pathname: string): string {
  const match = pathname.match(/^\/events\/[^/]+\/admissions\/([^/]+)$/);
  const id = match?.[1] ?? "";

  return isUuid(id) ? id : "";
}

function formatPersonName(
  person: { givenName: string; familyName: string } | undefined,
): string | undefined {
  if (!person) {
    return undefined;
  }

  const name = `${person.givenName} ${person.familyName}`.trim();

  return name.length > 0 ? name : undefined;
}

export function useAdminBreadcrumbs(): AdminBreadcrumbSegment[] {
  const { pathname } = useLocation();
  const eventId = parseEventWorkspaceEventId(pathname) ?? "";
  const personId = parsePersonId(pathname);
  const admissionId = parseAdmissionId(pathname);

  const eventQuery = useQuery({
    ...adminApi.event.detail(eventId),
    enabled: Boolean(eventId),
  });
  const personQuery = useQuery({
    ...adminApi.person.detail(personId),
    enabled: Boolean(personId),
  });
  const admissionQuery = useQuery({
    ...adminApi.admission.detail(admissionId),
    enabled: Boolean(admissionId),
  });

  return useMemo(
    () =>
      buildAdminBreadcrumbs(pathname, {
        eventTitle: eventQuery.data?.title,
        personName: formatPersonName(personQuery.data),
        admissionGuestName: formatPersonName(admissionQuery.data),
      }),
    [pathname, eventQuery.data?.title, personQuery.data, admissionQuery.data],
  );
}
