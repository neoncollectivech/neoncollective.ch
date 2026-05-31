import { type } from "arktype";

export const adminRegenerateInviteLinkSchema = type({
  "maxRedemptions?": "number | null",
});

export const adminInviteLinkMaxRedemptionsSchema = type({
  maxRedemptions: "number.integer>=0",
});

export const adminPeopleVerifySchema = type({
  personIds: "string.uuid[]>=1",
});

export const adminPersonCreateSchema = type({
  givenName: "string>0",
  familyName: "string>0",
  email: "string.email | null",
  phoneE164: "string | null",
  "markVerified?": "boolean",
});

const promotionTierOverrideSchema = type({
  eventTierId: "string.uuid",
  priceCents: "number.integer>=0",
});

export const adminPromotionCodeCreateSchema = type({
  code: "string>0",
  kind: "'percent_off' | 'amount_off' | 'tier_prices'",
  "percentBps?": "number.integer>=0",
  "amountOffCents?": "number.integer>=0",
  "tierOverrides?": promotionTierOverrideSchema.array(),
  "maxRedemptions?": "number.integer>=0 | null",
  "active?": "boolean",
  "startsAt?": "string | null",
  "endsAt?": "string | null",
});

export const adminPromotionCodePatchSchema = type({
  "active?": "boolean",
  "maxRedemptions?": "number.integer>=0 | null",
  "startsAt?": "string | null",
  "endsAt?": "string | null",
  "tierOverrides?": promotionTierOverrideSchema.array(),
  "kind?": "'percent_off' | 'amount_off' | 'tier_prices'",
  "percentBps?": "number.integer>=0",
  "amountOffCents?": "number.integer>=0",
});

export const adminEventTiersPutSchema = type({
  tiers: type({
    id: "string | null",
    name: "string>0",
    description: "string",
    priceCents: "number.integer>0",
    currency: "string",
    quota: "number | null",
    sortOrder: "number.integer",
    active: "boolean",
    selectionMode: "'exclusive' | 'addon'",
  }).array(),
});

export const adminEventImagePresignSchema = type({
  filename: "string>0",
  contentType: "string>0",
  byteSize: "number.integer>0",
});

export const adminEventImageCreateSchema = type({
  storageKey: "string>0",
  contentType: "string>0",
  byteSize: "number.integer>0",
  "altText?": "string | null",
});

export const adminEventImageReorderSchema = type({
  imageIds: "string.uuid[]>=1",
});
