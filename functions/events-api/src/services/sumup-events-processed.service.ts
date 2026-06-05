import { eq } from "drizzle-orm";

import { sumupEventsProcessed } from "../db/schema";
import type { EntityTx } from "./transaction";

export class SumupEventsProcessedService {
  async isProcessedInTx(tx: EntityTx, sumupEventId: string): Promise<boolean> {
    const [row] = await tx
      .select({ id: sumupEventsProcessed.sumupEventId })
      .from(sumupEventsProcessed)
      .where(eq(sumupEventsProcessed.sumupEventId, sumupEventId))
      .limit(1);
    return Boolean(row);
  }

  async claimInTx(tx: EntityTx, sumupEventId: string): Promise<boolean> {
    const inserted = await tx
      .insert(sumupEventsProcessed)
      .values({ sumupEventId })
      .onConflictDoNothing()
      .returning({ id: sumupEventsProcessed.sumupEventId });
    return inserted.length > 0;
  }
}

export const sumupEventsProcessedService = new SumupEventsProcessedService();
