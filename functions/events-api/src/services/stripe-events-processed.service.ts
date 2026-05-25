import { eq } from "drizzle-orm";

import { stripeEventsProcessed } from "../db/schema";
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
}

export const stripeEventsProcessedService = new StripeEventsProcessedService();
