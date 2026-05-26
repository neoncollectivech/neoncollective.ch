import { lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { authSession } from "../db/auth-schema";
import { countRowsWhere, purgeIdTableInBatches } from "./base/purge-batches";

export class AuthSessionService {
  private maintenanceWhere(): SQL {
    return lt(authSession.expiresAt, new Date());
  }

  async countMaintenanceEligible(): Promise<number> {
    return countRowsWhere(authSession, this.maintenanceWhere());
  }

  async purgeMaintenanceEligible(): Promise<number> {
    return purgeIdTableInBatches(
      authSession,
      authSession.id,
      this.maintenanceWhere(),
    );
  }
}

export const authSessionService = new AuthSessionService();
