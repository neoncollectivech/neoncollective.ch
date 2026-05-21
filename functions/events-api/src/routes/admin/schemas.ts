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
