import { stripeEventsProcessed } from "../db/schema";
import type { EntityTx } from "./transaction";

export class StripeEventsProcessedService {
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
