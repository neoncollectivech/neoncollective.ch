import { type ListQuery, type ListResult } from "@neon/admin-crud";

import { customListMeta } from "../../../services/base";
import type { ServiceContext } from "../../../services/base/types";
import { admissionsService } from "../../../services/admissions.service";
import { eventsService } from "../../../services/events.service";
import { inviteRedemptionsService } from "../../../services/invite-redemptions.service";
import { ordersService, type OrdersListFilters } from "../../../services/orders.service";
import { peopleService } from "../../../services/people.service";
import { listAdminOrderTierLines } from "../../shared/format-order-tiers";

type OrderRow = NonNullable<Awaited<ReturnType<typeof ordersService.get>>>;
type PersonRow = NonNullable<Awaited<ReturnType<typeof peopleService.get>>>;

export type OrderListRow = {
  id: string;
  eventId: string;
  status: OrderRow["status"];
  amountCents: number;
  createdAt: Date;
  person: {
    id: string;
    givenName: string;
    familyName: string;
    email: string | null;
  };
  event: { id: string; slug: string; title: string };
};

function serializeAdminOrderListRow(row: {
  order: OrderRow;
  person: PersonRow;
  event: { id: string; slug: string; title: string };
}): OrderListRow {
  return {
    id: row.order.id,
    eventId: row.order.eventId,
    status: row.order.status,
    amountCents: row.order.amountCents,
    createdAt: row.order.createdAt,
    person: {
      id: row.person.id,
      givenName: row.person.givenName,
      familyName: row.person.familyName,
      email: row.person.email,
    },
    event: row.event,
  };
}

export async function listAdminOrders(
  query: ListQuery<OrdersListFilters>,
  _ctx?: ServiceContext,
): Promise<ListResult<OrderListRow>> {
  const whereClause = await ordersService.buildAdminListWhere(query);
  const orderRows = await ordersService.listAdminRows({
    where: whereClause,
    limit: query.limit,
    skip: query.skip,
  });

  const personIds = [...new Set(orderRows.map((o) => o.personId))];
  const eventIds = [...new Set(orderRows.map((o) => o.eventId))];
  const [peopleRows, eventRows] = await Promise.all([
    peopleService.getByIds(personIds),
    eventsService.getByIds(eventIds),
  ]);
  const peopleById = new Map(peopleRows.map((p) => [p.id, p]));
  const eventsById = new Map(eventRows.map((e) => [e.id, e]));

  const items: OrderListRow[] = [];
  for (const order of orderRows) {
    const person = peopleById.get(order.personId);
    const event = eventsById.get(order.eventId);
    if (!person || !event) {
      continue;
    }
    items.push(
      serializeAdminOrderListRow({
        order,
        person,
        event: { id: event.id, slug: event.slug, title: event.title },
      }),
    );
  }

  const total = await countAdminOrders(query, _ctx);
  return {
    items,
    meta: customListMeta(query, whereClause, total),
  };
}

export async function countAdminOrders(
  query: ListQuery<OrdersListFilters>,
  _ctx?: ServiceContext,
): Promise<number> {
  const whereClause = await ordersService.buildAdminListWhere(query);
  return ordersService.countAdminRows(whereClause);
}

export async function getAdminOrderDetail(id: string, _ctx?: ServiceContext) {
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
