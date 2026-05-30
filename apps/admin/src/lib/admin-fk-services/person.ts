import { listPeople } from "@/lib/admin-api";

import { createIdKeyedFkService } from "./create-id-keyed-fk-service";

export const personFkService = createIdKeyedFkService({
  id: "person",
  defaultIdKey: "personId",
  batchIdFromRow: (row) => row.personId,
  list: listPeople,
  href: (id) => `/people/${id}`,
});
