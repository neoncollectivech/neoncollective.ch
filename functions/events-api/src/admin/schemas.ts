import { type } from "arktype";

export const adminEventCreateSchema = type({
  slug: "string>0",
  title: "string>0",
  summary: "string | null",
  location: "string | null",
  imageUrls: "string[]",
  startsAt: "string | null",
  accessMode: "'public' | 'invite_only'",
  eventQuota: "number | null",
  defaultInviteLinkMaxRedemptions: "number",
});

export const adminEventUpdateSchema = type({
  "slug?": "string>0",
  "title?": "string>0",
  "summary?": "string | null",
  "location?": "string | null",
  "imageUrls?": "string[]",
  "startsAt?": "string | null",
  "status?": "'draft' | 'published'",
  "accessMode?": "'public' | 'invite_only'",
  "eventQuota?": "number | null",
  "defaultInviteLinkMaxRedemptions?": "number",
});

export const adminEventListQuerySchema = type({
  "page?": "string",
  "pageSize?": "string",
  "sort?": "string",
  "q?": "string",
  "status?": "'draft' | 'published'",
  "accessMode?": "'public' | 'invite_only'",
});

export const adminInviteeUpdateSchema = type({
  "notes?": "string | null",
});

export const adminRegenerateInviteLinkSchema = type({
  "maxRedemptions?": "number | null",
});

export const adminInviteLinkMaxRedemptionsSchema = type({
  maxRedemptions: "number.integer>=0",
});

export const adminPeopleVerifySchema = type({
  personIds: "string.uuid[]>=1",
});

export const adminPersonUpdateSchema = type({
  "givenName?": "string>0",
  "familyName?": "string>0",
  "email?": "string.email | null",
  "phoneE164?": "string | null",
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
