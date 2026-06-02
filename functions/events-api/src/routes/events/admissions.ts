import type { ListScopeQuery } from "../shared/list-scope";
import { admissionsService } from "../../services/admissions.service";

export async function listPublicAdmissionsForEvent(
  eventId: string,
  scope: ListScopeQuery,
) {
  return admissionsService.listPublicForEvent(eventId, scope);
}
