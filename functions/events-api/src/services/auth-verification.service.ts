import { lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { authVerification } from "../db/auth-schema";
import { countRowsWhere, purgeIdTableInBatches } from "./base/purge-batches";

export class AuthVerificationService {
  private maintenanceWhere(): SQL {
    return lt(authVerification.expiresAt, new Date());
  }

  async countMaintenanceEligible(): Promise<number> {
    return countRowsWhere(authVerification, this.maintenanceWhere());
  }

  async purgeMaintenanceEligible(): Promise<number> {
    return purgeIdTableInBatches(
      authVerification,
      authVerification.id,
      this.maintenanceWhere(),
    );
  }
}

export const authVerificationService = new AuthVerificationService();
