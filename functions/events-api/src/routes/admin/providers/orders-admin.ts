import { admissionsService } from "../../../services/admissions.service";
import { eventsService } from "../../../services/events.service";
import { inviteRedemptionsService } from "../../../services/invite-redemptions.service";
import { ordersService } from "../../../services/orders.service";
import { peopleService } from "../../../services/people.service";
import { listAdminOrderTierLines } from "../../shared/format-order-tiers";

export async function getAdminOrderDetail(id: string) {
  const order = await ordersService.get(id);
  if (!order) {
    return null;
  }

  const [person, event] = await Promise.all([
    peopleService.get(order.personId),
    eventsService.get(order.eventId),
  ]);
  if (!person || !event) {
    return null;
  }

  const [tiers, admission, inviteRedemption] = await Promise.all([
    listAdminOrderTierLines(id),
    admissionsService.findByOrderId(id),
    inviteRedemptionsService.findByOrderId(id),
  ]);

  return {
    ...order,
    person,
    tiers,
    event: { id: event.id, slug: event.slug, title: event.title },
    admission: admission ?? null,
    inviteRedemption: inviteRedemption ?? null,
  };
}
