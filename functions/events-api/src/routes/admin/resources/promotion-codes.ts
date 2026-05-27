import {
  promotionCodesResourceMeta,
  promotionCodesService,
  promotionCodesTable,
} from "../../../services/promotion-codes.service";
import { defineResource, tableServiceToBridge } from "@neon/resource-api";

export const promotionCodesResource = defineResource({
  table: promotionCodesTable,
  meta: promotionCodesResourceMeta,
  service: tableServiceToBridge(promotionCodesService),
  opts: {
    operations: ["list", "read"],
  },
});
