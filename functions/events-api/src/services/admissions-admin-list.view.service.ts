import { introspectTable } from "@neon/resource-api";

import { admissionsAdminListView } from "../db/views";
import { TableService } from "./base/table-service";

export { admissionsAdminListView as admissionsAdminListTable };

export type AdmissionsAdminListRow = {
  id: string;
  orderId: string;
  eventId: string;
  signedCredential: string;
  personId: string;
  givenName: string;
  familyName: string;
  checkedInAt: Date | null;
  checkedInBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export const admissionsAdminListReadFields = [
  "id",
  "orderId",
  "eventId",
  "signedCredential",
  "personId",
  "givenName",
  "familyName",
  "checkedInAt",
  "checkedInBy",
  "revokedAt",
  "createdAt",
] as const;

export const admissionsAdminListResourceMeta = introspectTable(admissionsAdminListView, {
  fields: {
    list: [...admissionsAdminListReadFields],
    read: [...admissionsAdminListReadFields],
    create: [],
    update: [],
  },
  exclude: {
    filter: ["signedCredential"],
    sort: ["signedCredential", "givenName", "familyName"],
  },
});

class AdmissionsAdminListViewService extends TableService<
  typeof admissionsAdminListView,
  AdmissionsAdminListRow,
  Record<string, never>,
  Record<string, never>
> {
  constructor() {
    super({
      table: admissionsAdminListView,
      meta: admissionsAdminListResourceMeta,
    });
  }
}

export const admissionsAdminListViewService = new AdmissionsAdminListViewService();
