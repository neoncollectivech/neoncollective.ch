// Row types mirror backend admin meta `project.list` field names.
export type {
  EventRow,
  OrderRow,
  PersonRow,
  EventInviteeListRow,
  EventReadRow,
  OrderReadRow,
  PersonReadRow,
  EventTierListRow,
  OrderTierRow,
  AdmissionRow,
  InviteRedemptionRow,
  InviteLinkRow,
  AdminListRequestParams,
} from "@/lib/admin-api";

export {
  eventsListService,
  ordersListService,
  peopleListService,
  eventInviteesListService,
  eventPromotionCodesListService,
  admissionsListService,
  type AdmissionsListScope,
  type PeopleListFilters,
  type EventInviteesListScope,
  type EventInviteesListFilters,
  type EventPromotionCodesListScope,
} from "./registry";

export { createAdminListService } from "./create";
export { createAdminListClient } from "./create-admin-list-client";

export {
  defineAdminListService,
  type AdminListServiceDefinition,
  type InferListRow,
  type InferListScope,
  type InferListFilters,
} from "./types";
