import type { FulfillPaidOrderResult } from "./fulfill-paid-order";
import { sendPostCheckoutParticipantAccessEmail } from "../registrations/session";

export async function handleFulfillmentResult(
  result: FulfillPaidOrderResult,
): Promise<void> {
  if (result.kind !== "send_email") {
    return;
  }

  try {
    await sendPostCheckoutParticipantAccessEmail(result.job);
  } catch {
    /* non-fatal */
  }
}
