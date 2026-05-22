/**
 * Admin list services — one file per paginated CRUD resource.
 *
 * To add a new admin table:
 * 1. Add `<resource>.ts` with `defineAdminListService` + `listQuery` (admin-api + adminKeys).
 * 2. Export from this barrel.
 * 3. Add `columns/<resource>-columns.tsx` and use `<AdminDataTable service={...} />`.
 */
export { eventsListService } from "./events";
export {
  eventInviteesListService,
  type EventInviteesListFilters,
  type EventInviteesListScope,
} from "./event-invitees";
export { ordersListService } from "./orders";
export { peopleListService, type PeopleListFilters } from "./people";
export {
  defineAdminListService,
  type AdminListQueryOptions,
  type AdminListServiceDefinition,
  type InferListFilters,
  type InferListRow,
  type InferListScope,
} from "./types";
