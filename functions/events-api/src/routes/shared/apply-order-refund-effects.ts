import { admissionsService } from "../../services/admissions.service";
import { eventRegistrationsService } from "../../services/event-registrations.service";
import { inviteRedemptionsService } from "../../services/invite-redemptions.service";
import { ordersService } from "../../services/orders.service";
import type { EntityTx } from "../../services/transaction";

type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.get>>>;

export async function applyOrderRefundEffectsInTx(
  tx: EntityTx,
  order: OrderRow,
): Promise<void> {
  await ordersService.markRefundedInTx(tx, order.id);

  const isPrimary =
    order.orderKind === "registration" ||
    (await eventRegistrationsService.findByPrimaryOrderIdInTx(tx, order.id)) != null;

  if (isPrimary) {
    const registration =
      (await eventRegistrationsService.findByPrimaryOrderIdInTx(tx, order.id)) ??
      (await eventRegistrationsService.findByPersonOnEventInTx(
        tx,
        order.personId,
        order.eventId,
      ));
    if (registration) {
      await eventRegistrationsService.markRefundedInTx(tx, registration.id);
      await admissionsService.revokeForRegistrationInTx(tx, registration.id);
    }
  } else if (order.registrationId) {
    const admission = await admissionsService.findAdmissionForPersonOnEventInTx(
      tx,
      order.personId,
      order.eventId,
    );
    if (admission) {
      await admissionsService.refreshSignedCredentialInTx(tx, admission, order.personId);
    }
  }

  await inviteRedemptionsService.deleteForOrderInTx(tx, order.id);
}
