import {
  collectBatchIdsForFk,
  eventFkService,
  formatForeignKeyDisplay,
  listParamsToQueryKey,
  orderFkService,
  personFkService,
  toForeignKeyLookupMap,
  type AdminFkServiceDefinition,
  type ForeignKeyLookupRow,
  type ForeignKeyPresentation,
  type ForeignKeyScope,
  type ForeignKeySourceRow,
} from "@/lib/admin-fk-services";

/** @deprecated Import from `@/lib/admin-fk-services` instead. */
export {
  collectBatchIdsForFk as collectBatchIds,
  eventFkService,
  formatForeignKeyDisplay,
  listParamsToQueryKey,
  orderFkService,
  personFkService,
  toForeignKeyLookupMap,
  type AdminFkServiceDefinition,
  type ForeignKeyLookupRow,
  type ForeignKeyPresentation,
  type ForeignKeyScope,
  type ForeignKeySourceRow,
};

/** @deprecated Use `AdminFkServiceDefinition["id"]` */
export type ForeignKeyService = "event" | "person" | "order";

/** @deprecated Use named fk services from `@/lib/admin-fk-services` */
export const FK_SERVICE_REGISTRY = {
  event: eventFkService,
  person: personFkService,
  order: orderFkService,
} as const;
