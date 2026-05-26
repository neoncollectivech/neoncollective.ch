import { eq, lt } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { STRIPE_EVENTS_PROCESSED_RETENTION_DAYS } from "../config/maintenance";
import { stripeEventsProcessed } from "../db/schema";
import {
  countRowsWhere,
  purgeStripeEventsInBatches,
} from "./base/purge-batches";
import type { EntityTx } from "./transaction";

export class StripeEventsProcessedService {
  async isProcessedInTx(tx: EntityTx, stripeEventId: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: stripeEventsProcessed.stripeEventId })
      .from(stripeEventsProcessed)
      .where(eq(stripeEventsProcessed.stripeEventId, stripeEventId))
      .limit(1);
    return Boolean(row);
  }

  /** Returns false when this Stripe event id was already processed. */
  async claimInTx(tx: EntityTx, stripeEventId: string): Promise<boolean> {
    const inserted = await tx
      .insert(stripeEventsProcessed)
      .values({ stripeEventId })
      .onConflictDoNothing()
      .returning({ id: stripeEventsProcessed.stripeEventId });
    return inserted.length > 0;
  }

  private maintenanceWhere(): SQL {
    const cutoff = new Date(
      Date.now() - STRIPE_EVENTS_PROCESSED_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );
    return lt(stripeEventsProcessed.processedAt, cutoff);
  }

  async countMaintenanceEligible(): Promise<number> {
    return countRowsWhere(stripeEventsProcessed, this.maintenanceWhere());
  }

  async purgeMaintenanceEligible(): Promise<number> {
    return purgeStripeEventsInBatches(this.maintenanceWhere());
  }
}

export const stripeEventsProcessedService = new StripeEventsProcessedService();
