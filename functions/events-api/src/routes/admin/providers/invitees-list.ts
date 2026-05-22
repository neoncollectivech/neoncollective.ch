import {
  listMetaFromScope,
  runAdminListFromScope,
  type ListProviderResult,
} from "@neon/admin-crud";
import type { AdminCrudContext } from "@neon/admin-crud";

import { getAdminCrudDb } from "../../../services/admin/crud-mount";
import { eventInviteesTable } from "../../../services/event-invitees.service";

import {
  projectInviteeListRow,
  resolveInviteesAdminListScope,
} from "./invitees-list-scope";

export async function listAdminEventInvitees(
  c: AdminCrudContext,
): Promise<ListProviderResult> {
  const raw = c.req.query() as Record<string, string | string[] | undefined>;
  const { scope } = resolveInviteesAdminListScope(raw);

  const db = getAdminCrudDb();
  const { rows, total } = await runAdminListFromScope({
    db,
    table: eventInviteesTable,
    scope,
  });

  return {
    items: rows.map(projectInviteeListRow),
    meta: listMetaFromScope(scope, total),
  };
}
