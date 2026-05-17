import {
  AdminApiError,
  parseAdminListQuery,
  registerAdminCrud,
  registerAdminRoute,
} from "@neon/admin-crud";
import { Hono } from "hono";

import type { AdminEnv } from "../auth/require-admin-session.js";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { getDb } from "../db/index.js";
import { eventInvitees, events, people } from "../db/schema.js";
import { mountBetterAuth } from "../auth/mount.js";
import { requireAdminSession } from "../auth/require-admin-session.js";
import {
  InviteMechanismDisabledError,
  InviteeUpsertError,
  ensureInviteLink,
  regenerateInviteLink,
  revokeInvitee,
  upsertInviteesForEvent,
} from "../services/admin-invitees.js";
import {
  InviteLinkUpdateError,
  updateInviteLinkMaxRedemptions,
} from "../services/admin-invite-links.js";
import { requireInviteOnlyEvent } from "../services/event-read.js";
import { listTiersForEvent, replaceEventTiers } from "../services/admin/event-tiers.js";
import { getAdminInviteeDetail, listAdminInviteesForEvent } from "../services/admin/invitees-read.js";
import { getAdminOrderDetail, listAdminOrdersQuery } from "../services/admin/orders-read.js";
import { getAdminPersonDetail } from "../services/admin/people-read.js";
import { prepareAdminPersonUpdate } from "../services/admin/update-person.js";
import { verifyPeopleBulk } from "../services/admin/verify-people.js";
import { refundOrder } from "../services/checkin-refund.js";
import { normalizeEventImageUrls } from "../services/event-read.js";
import {
  adminEventCreateSchema,
  adminEventListQuerySchema,
  adminEventTiersPutSchema,
  adminEventUpdateSchema,
  adminInviteeUpdateSchema,
  adminInviteLinkMaxRedemptionsSchema,
  adminPeopleVerifySchema,
  adminPersonUpdateSchema,
  adminRegenerateInviteLinkSchema,
} from "./schemas.js";
import { adminInviteesUpsertSchema } from "../schemas.js";

const adminAuth = [requireAdminSession];

function parseStartsAt(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function createAdminRouter(): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  mountBetterAuth(admin);

  admin.onError((err, c) => {
    if (err instanceof InviteMechanismDisabledError) {
      return c.json({ error: err.message }, 403);
    }
    if (err instanceof AdminApiError) {
      return c.json({ error: err.message }, err.statusCode as ContentfulStatusCode);
    }
    throw err;
  });

  const db = () => getDb();
  // registerAdminCrud expects untyped Hono for dynamic route registration
  const crudApp = admin as unknown as import("hono").Hono;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routes = admin as any;

  registerAdminCrud(crudApp, {
    resource: "events",
    table: events,
    idColumn: events.id,
    operations: ["list", "read", "create", "update"],
    middleware: adminAuth,
    getDb: db,
    schemas: {
      create: adminEventCreateSchema,
      update: adminEventUpdateSchema,
      listQuery: adminEventListQuerySchema,
    },
    fields: {
      create: [
        "slug",
        "title",
        "summary",
        "location",
        "imageUrls",
        "startsAt",
        "accessMode",
        "eventQuota",
        "defaultInviteLinkMaxRedemptions",
      ],
      update: [
        "slug",
        "title",
        "summary",
        "location",
        "imageUrls",
        "startsAt",
        "status",
        "accessMode",
        "eventQuota",
        "defaultInviteLinkMaxRedemptions",
      ],
      list: [
        "id",
        "slug",
        "title",
        "status",
        "accessMode",
        "startsAt",
        "createdAt",
      ],
      read: "*",
    },
    searchFields: [events.title, events.slug],
    filterFields: {
      status: events.status,
      accessMode: events.accessMode,
    },
    sortFields: {
      startsAt: events.startsAt,
      createdAt: events.createdAt,
      title: events.title,
    },
    defaultSort: "-startsAt",
    hooks: {
      beforeCreate: async (data) => ({
        ...data,
        slug: String(data.slug).trim().toLowerCase(),
        imageUrls: normalizeEventImageUrls(data.imageUrls),
        startsAt: parseStartsAt(data.startsAt as string | null | undefined),
        status: "draft",
      }),
      beforeUpdate: async (_id, data) => ({
        ...data,
        ...(data.slug !== undefined
          ? { slug: String(data.slug).trim().toLowerCase() }
          : {}),
        ...(data.imageUrls !== undefined
          ? { imageUrls: normalizeEventImageUrls(data.imageUrls) }
          : {}),
        ...(data.startsAt !== undefined
          ? { startsAt: parseStartsAt(data.startsAt as string | null | undefined) }
          : {}),
      }),
    },
    serialize: async (row, c) => {
      const id = c.req.param("id");
      if (id && id === String(row.id)) {
        const tiers = await listTiersForEvent(id);
        return { ...row, tiers };
      }
      return row;
    },
  });

  routes.put("/events/:id/tiers", ...adminAuth, async (c: import("hono").Context) => {
      const eventId = c.req.param("id")!;
      const body = adminEventTiersPutSchema.assert(await c.req.json());
      const res = await replaceEventTiers(eventId, body.tiers);
      if ("error" in res) {
        return c.json({ error: res.error }, res.status as ContentfulStatusCode);
      }
      return c.json({ tiers: res.tiers });
    },
  );

  registerAdminCrud(crudApp, {
    resource: "people",
    table: people,
    idColumn: people.id,
    operations: ["list", "read", "update"],
    middleware: adminAuth,
    getDb: db,
    schemas: {
      update: adminPersonUpdateSchema,
    },
    fields: {
      list: [
        "id",
        "givenName",
        "familyName",
        "email",
        "phone",
        "emailVerifiedAt",
        "phoneVerifiedAt",
        "createdAt",
      ],
      read: "*",
      update: [
        "givenName",
        "familyName",
        "email",
        "phone",
        "emailVerifiedAt",
        "phoneVerifiedAt",
        "updatedAt",
      ],
    },
    searchFields: [people.givenName, people.familyName, people.email, people.phone],
    sortFields: { createdAt: people.createdAt },
    defaultSort: "-createdAt",
    hooks: {
      beforeUpdate: async (id, data) =>
        prepareAdminPersonUpdate(id, data as import("../services/admin/update-person.js").AdminPersonUpdateInput),
    },
    serialize: async (row, c) => {
      const id = c.req.param("id");
      if (id && id === String(row.id)) {
        const detail = await getAdminPersonDetail(id);
        return detail ?? row;
      }
      return row;
    },
  });

  registerAdminRoute(crudApp, {
    method: "post",
    path: "/people/verify",
    middleware: adminAuth,
    handler: async (c) => {
      const body = adminPeopleVerifySchema.assert(await c.req.json());
      const summary = await verifyPeopleBulk(body.personIds);
      return c.json({ ok: true, meta: summary });
    },
  });

  routes.get("/orders", ...adminAuth, async (c: import("hono").Context) => {
    const query = c.req.query();
    const parsed = parseAdminListQuery(query);
    const result = await listAdminOrdersQuery({
      eventId: query.eventId,
      status: query.status,
      q: parsed.q,
      page: parsed.page,
      pageSize: parsed.pageSize,
    });
    return c.json(result);
  });

  routes.get("/orders/:id", ...adminAuth, async (c: import("hono").Context) => {
    const detail = await getAdminOrderDetail(c.req.param("id")!);
    if (!detail) {
      return c.json({ error: "Not found." }, 404);
    }
    return c.json({ item: detail });
  });

  routes.get("/events/:eventId/invitees", ...adminAuth, async (c: import("hono").Context) => {
    const items = await listAdminInviteesForEvent(c.req.param("eventId")!);
    return c.json({ items, meta: { page: 1, pageSize: items.length, total: items.length } });
  });

  registerAdminCrud(crudApp, {
    resource: "invitees",
    basePath: "/events/:eventId",
    table: eventInvitees,
    idColumn: eventInvitees.id,
    parent: { param: "eventId", column: eventInvitees.eventId },
    operations: ["read", "update"],
    middleware: adminAuth,
    getDb: db,
    schemas: {
      update: adminInviteeUpdateSchema,
    },
    fields: {
      update: ["notes"],
      read: "*",
    },
    serialize: async (row, c) => {
      const detail = await getAdminInviteeDetail(
        c.req.param("eventId"),
        String(row.id),
      );
      return detail ?? row;
    },
    hooks: {
      beforeUpdate: async (_id, data, c) => {
        await requireInviteOnlyEvent(c.req.param("eventId")!);
        return data;
      },
    },
  });

  routes.post("/events/:eventId/invitees", ...adminAuth, async (c: import("hono").Context) => {
      const eventId = c.req.param("eventId")!;
      const body = adminInviteesUpsertSchema.assert(await c.req.json());
      try {
        const summary = await upsertInviteesForEvent(eventId, body.invitees);
        return c.json({
          results: summary.results,
          meta: {
            created: summary.created,
            skipped: summary.skipped,
            invalid: summary.invalid,
          },
        });
      } catch (e) {
        if (e instanceof InviteMechanismDisabledError) {
          return c.json({ error: e.message }, 403);
        }
        if (e instanceof InviteeUpsertError) {
          const status = e.code === "contact_required" ? 400 : 409;
          return c.json({ error: e.message }, status);
        }
        throw e;
      }
    },
  );

  registerAdminRoute(crudApp, {
    method: "post",
    path: "/events/:eventId/invitees/:inviteeId/revoke",
    middleware: adminAuth,
    handler: async (c) => {
      const ok = await revokeInvitee(c.req.param("eventId"), c.req.param("inviteeId"));
      if (!ok) {
        return c.json({ error: "Invitee not found." }, 404);
      }
      return c.json({ ok: true });
    },
  });

  registerAdminRoute(crudApp, {
    method: "post",
    path: "/events/:eventId/invitees/:inviteeId/ensure-link",
    middleware: adminAuth,
    handler: async (c) => {
      const result = await ensureInviteLink(
        c.req.param("eventId"),
        c.req.param("inviteeId"),
      );
      if (!result.ok) {
        if (result.reason === "profile_pending") {
          return c.json(
            { error: "Invitee has no linked person yet — they must complete their profile first." },
            400,
          );
        }
        return c.json({ error: "Invitee not found." }, 404);
      }
      return c.json({ inviteToken: result.inviteToken });
    },
  });

  registerAdminRoute(crudApp, {
    method: "post",
    path: "/events/:eventId/invitees/:inviteeId/regenerate-link",
    middleware: adminAuth,
    handler: async (c) => {
      const body = adminRegenerateInviteLinkSchema.assert(await c.req.json().catch(() => ({})));
      const result = await regenerateInviteLink(
        c.req.param("eventId"),
        c.req.param("inviteeId"),
        body.maxRedemptions,
      );
      if (!result.ok) {
        if (result.reason === "profile_pending") {
          return c.json(
            { error: "Invitee has no linked person yet — they must complete their profile first." },
            400,
          );
        }
        return c.json({ error: "Invitee not found." }, 404);
      }
      return c.json({ inviteToken: result.inviteToken });
    },
  });

  registerAdminRoute(crudApp, {
    method: "patch",
    path: "/events/:eventId/invite-links/:linkId",
    middleware: adminAuth,
    handler: async (c) => {
      const body = adminInviteLinkMaxRedemptionsSchema.assert(await c.req.json());
      try {
        const item = await updateInviteLinkMaxRedemptions(
          c.req.param("eventId"),
          c.req.param("linkId"),
          body.maxRedemptions,
        );
        return c.json({ item });
      } catch (e) {
        if (e instanceof InviteLinkUpdateError) {
          if (e.code === "not_found") {
            return c.json({ error: e.message }, 404);
          }
          return c.json({ error: e.message }, 400);
        }
        throw e;
      }
    },
  });

  registerAdminRoute(crudApp, {
    method: "post",
    path: "/orders/:id/refund",
    middleware: adminAuth,
    handler: async (c) => {
      const res = await refundOrder({ orderId: c.req.param("id") });
      if (!res.ok) {
        return c.json({ error: res.error }, res.status as ContentfulStatusCode);
      }
      return c.json({ ok: true });
    },
  });

  return admin;
}
