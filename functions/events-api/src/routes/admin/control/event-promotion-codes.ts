import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  normalizePromotionCode,
  validateTierOverrides,
  type PromotionTierOverride,
} from "../../../helpers/promotion-code";
import { eventTiersService } from "../../../services/event-tiers.service";
import { eventsService } from "../../../services/events.service";
import { ordersService } from "../../../services/orders.service";
import { promotionCodesService } from "../../../services/promotion-codes.service";
import { runTransaction } from "../../../services/transaction";
import {
  adminPromotionCodeCreateSchema,
  adminPromotionCodePatchSchema,
} from "../schemas";
import { jsonReasonFailure } from "../../shared/respond";

const PROMO_ERRORS = {
  event_not_found: { status: 404 as ContentfulStatusCode, error: "Event not found." },
  invalid_code: { status: 400 as ContentfulStatusCode, error: "Invalid promotion code." },
  duplicate_code: { status: 409 as ContentfulStatusCode, error: "Code already exists for this event." },
  invalid_tier_overrides: {
    status: 400 as ContentfulStatusCode,
    error: "Invalid tier overrides for this event.",
  },
  promotion_not_found: {
    status: 404 as ContentfulStatusCode,
    error: "Promotion code not found.",
  },
  kind_locked: {
    status: 409 as ContentfulStatusCode,
    error: "Cannot change promotion type after redemptions exist.",
  },
} as const;

function tierOverrideMessage(
  result: { ok: false; reason: string } | { ok: true },
): string {
  return result.ok ? "" : result.reason;
}

async function eventTierIdSet(eventId: string): Promise<Set<string>> {
  const tiers = await eventTiersService.listForEvent(eventId);
  return new Set(tiers.map((t) => t.id));
}

export async function listEventPromotionCodesHandler(c: Context): Promise<Response> {
  const eventId = c.req.param("id")!;
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, PROMO_ERRORS);
  }
  const rows = await runTransaction((tx) =>
    promotionCodesService.listForEventInTx(tx, eventId),
  );
  const items = await Promise.all(
    rows.map(async (row) => {
      const stats = await ordersService.promotionUsageStats(row.id, {
        maxRedemptions: row.maxRedemptions,
      });
      return {
        ...row,
        usedRedemptions: stats.usedRedemptions,
        remainingRedemptions: stats.remainingRedemptions,
      };
    }),
  );
  return c.json({ items });
}

export async function createEventPromotionCodeHandler(c: Context): Promise<Response> {
  const eventId = c.req.param("id")!;
  const body = adminPromotionCodeCreateSchema.assert(await c.req.json());
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, PROMO_ERRORS);
  }
  const normalized = normalizePromotionCode(body.code);
  if (!normalized) {
    return jsonReasonFailure(c, { reason: "invalid_code" }, PROMO_ERRORS);
  }
  const tierIds = await eventTierIdSet(eventId);
  if (body.kind === "tier_prices") {
    const overrides = body.tierOverrides as PromotionTierOverride[];
    const validated = validateTierOverrides(overrides, tierIds);
    if (!validated.ok) {
      return c.json(
        { error: tierOverrideMessage(validated) || PROMO_ERRORS.invalid_tier_overrides.error },
        400,
      );
    }
  }
  const row = await runTransaction(async (tx) => {
    const existing = await promotionCodesService.findByEventAndCodeInTx(tx, eventId, normalized);
    if (existing) {
      return null;
    }
    return promotionCodesService.createInTx(tx, {
      eventId,
      code: normalized,
      kind: body.kind,
      percentBps: body.kind === "percent_off" ? body.percentBps : null,
      amountOffCents: body.kind === "amount_off" ? body.amountOffCents : null,
      tierOverrides:
        body.kind === "tier_prices" ? (body.tierOverrides as PromotionTierOverride[]) : [],
      maxRedemptions: body.maxRedemptions ?? null,
      active: body.active ?? true,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
    });
  });
  if (!row) {
    return jsonReasonFailure(c, { reason: "duplicate_code" }, PROMO_ERRORS);
  }
  return c.json({ item: row }, 201);
}

export async function patchEventPromotionCodeHandler(c: Context): Promise<Response> {
  const eventId = c.req.param("id")!;
  const promotionCodeId = c.req.param("promotionCodeId")!;
  const body = adminPromotionCodePatchSchema.assert(await c.req.json());
  const ev = await eventsService.get(eventId);
  if (!ev) {
    return jsonReasonFailure(c, { reason: "event_not_found" }, PROMO_ERRORS);
  }
  const existing = await promotionCodesService.get(promotionCodeId);
  if (!existing || existing.eventId !== eventId) {
    return jsonReasonFailure(c, { reason: "promotion_not_found" }, PROMO_ERRORS);
  }
  const used = (
    await ordersService.promotionUsageStats(promotionCodeId)
  ).usedRedemptions;
  if (used > 0 && (body.kind != null || body.percentBps != null || body.amountOffCents != null)) {
    return jsonReasonFailure(c, { reason: "kind_locked" }, PROMO_ERRORS);
  }
  const tierIds = await eventTierIdSet(eventId);
  if (body.tierOverrides) {
    const validated = validateTierOverrides(body.tierOverrides as PromotionTierOverride[], tierIds);
    if (!validated.ok) {
      return c.json(
        { error: tierOverrideMessage(validated) || PROMO_ERRORS.invalid_tier_overrides.error },
        400,
      );
    }
  }
  const patch: Record<string, unknown> = {};
  if (body.active != null) {
    patch.active = body.active;
  }
  if (body.maxRedemptions !== undefined) {
    patch.maxRedemptions = body.maxRedemptions;
  }
  if (body.startsAt !== undefined) {
    patch.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  }
  if (body.endsAt !== undefined) {
    patch.endsAt = body.endsAt ? new Date(body.endsAt) : null;
  }
  if (body.tierOverrides) {
    patch.tierOverrides = body.tierOverrides;
  }
  const row = await runTransaction((tx) =>
    promotionCodesService.updateInTx(tx, promotionCodeId, eventId, patch),
  );
  if (!row) {
    return jsonReasonFailure(c, { reason: "promotion_not_found" }, PROMO_ERRORS);
  }
  return c.json({ item: row });
}
