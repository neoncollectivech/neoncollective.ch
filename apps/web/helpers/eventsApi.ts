import { createPublicApiClient } from "./createPublicApiClient";
import { parsePublicEventImages, type EventImage } from "./event-image-focal";

const EVENTS_API_URL = process.env.NEXT_PUBLIC_EVENTS_API_URL;

export const eventsClient = createPublicApiClient({
  envUrl: EVENTS_API_URL,
  envLabel: "NEXT_PUBLIC_EVENTS_API_URL",
  warnMissing: "server",
  withCredentials: true,
});

export type TierSelectionMode = "exclusive" | "addon";

export type EventTier = {
  id: string;
  name: string;
  /** What this contribution tier includes. */
  description: string;
  priceCents: number;
  currency: string;
  /** `null` = no tier cap (only event-level quota applies). */
  placesRemaining: number | null;
  active: boolean;
  sortOrder: number;
  selectionMode: TierSelectionMode;
};

export type EventPayload = {
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  images: EventImage[];
  startsAt: string | null;
  accessMode: "public" | "invite_only";
  inviteOnly: boolean;
  /** When `"minimal"` (invite-only, not entitled), dossier fields are null/empty except title. */
  access?: "full" | "minimal";
  inviteRemaining?: number;
  tiers?: EventTier[];
  /** True when the session cookie matches a person with a paid order for this event. */
  registrationConfirmed?: boolean;
  registeredTierName?: string;
  registeredTiers?: RegisteredOrderTier[];
  availableUpsellTiers?: EventTier[];
  /** Host first name when registration is confirmed on invite-only events. */
  viewerGivenName?: string;
  /** Guest invite link for first-degree hosts (session + paid registration). */
  hostInvite?: {
    token: string;
    remaining: number;
    conversions: InviteLinkConversion[];
  };
};

/** Paid order tier lines returned on event detail when registration is confirmed. */
export type RegisteredOrderTier = {
  id: string;
  name: string;
  description: string;
  selectionMode: TierSelectionMode;
  priceCents: number;
  currency: string;
};

export type InviteLinkConversion = {
  orderId: string;
  givenName: string;
  familyName: string;
  tierName: string;
  registeredAt: string;
};

/** Catalog row from `GET /events` (public + invite-only when session matches an event invite). */
export type EventCatalogItem = {
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  images: EventImage[];
  startsAt: string | null;
  inviteOnly: boolean;
  /** True when the session has a paid order for this event. */
  registrationConfirmed: boolean;
};

export type ParticipantProfile = {
  profileComplete: boolean;
  /** Guest arrived via invite link — profile gate applies. */
  inviteFlow: boolean;
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  pendingVerification: "email" | "phone" | null;
};

export async function fetchEventsCatalog(opts?: {
  inviteToken?: string;
}): Promise<EventCatalogItem[]> {
  if (!EVENTS_API_URL) {
    return [];
  }
  try {
    const qs = opts?.inviteToken
      ? `?invite=${encodeURIComponent(opts.inviteToken)}`
      : "";
    const { data } = await eventsClient.get<{ events: EventCatalogItem[] }>(
      `/events${qs}`,
    );

    return Array.isArray(data.events)
      ? data.events.map((e) => ({
          slug: e.slug,
          title: e.title,
          summary: e.summary ?? null,
          location: e.location ?? null,
          images: parsePublicEventImages(e.images),
          startsAt: e.startsAt ?? null,
          inviteOnly: Boolean(e.inviteOnly),
          registrationConfirmed: Boolean(e.registrationConfirmed),
        }))
      : [];
  } catch {
    return [];
  }
}

export async function fetchEvent(
  slug: string,
  opts?: { inviteToken?: string },
): Promise<EventPayload> {
  const qs = opts?.inviteToken
    ? `?invite=${encodeURIComponent(opts.inviteToken)}`
    : "";
  const { data } = await eventsClient.get<EventPayload>(`/events/${slug}${qs}`);
  const { hostInvite: rawHostInvite, ...eventFields } = data;

  const images = parsePublicEventImages(data.images);

  const tiers = Array.isArray(data.tiers)
    ? data.tiers.map((tier) => ({
        ...tier,
        selectionMode:
          tier.selectionMode === "addon"
            ? ("addon" as const)
            : ("exclusive" as const),
      }))
    : undefined;
  const availableUpsellTiers = Array.isArray(data.availableUpsellTiers)
    ? data.availableUpsellTiers.map((tier) => ({
        ...tier,
        selectionMode:
          tier.selectionMode === "addon"
            ? ("addon" as const)
            : ("exclusive" as const),
      }))
    : undefined;

  return {
    ...eventFields,
    summary: eventFields.summary ?? null,
    location: eventFields.location ?? null,
    images,
    tiers,
    availableUpsellTiers,
    registrationConfirmed: Boolean(eventFields.registrationConfirmed),
    registeredTierName:
      typeof eventFields.registeredTierName === "string" &&
      eventFields.registeredTierName.trim().length > 0
        ? eventFields.registeredTierName.trim()
        : undefined,
    registeredTiers: Array.isArray(eventFields.registeredTiers)
      ? eventFields.registeredTiers
          .filter(
            (tier): tier is RegisteredOrderTier =>
              Boolean(tier) &&
              typeof tier === "object" &&
              typeof (tier as RegisteredOrderTier).id === "string" &&
              typeof (tier as RegisteredOrderTier).name === "string" &&
              typeof (tier as RegisteredOrderTier).description === "string" &&
              typeof (tier as RegisteredOrderTier).priceCents === "number" &&
              typeof (tier as RegisteredOrderTier).currency === "string" &&
              ((tier as RegisteredOrderTier).selectionMode === "exclusive" ||
                (tier as RegisteredOrderTier).selectionMode === "addon"),
          )
          .map((tier) => ({
            id: tier.id,
            name: tier.name.trim(),
            description: tier.description.trim(),
            selectionMode: tier.selectionMode,
            priceCents: tier.priceCents,
            currency: tier.currency,
          }))
      : undefined,
    viewerGivenName:
      typeof eventFields.viewerGivenName === "string" &&
      eventFields.viewerGivenName.trim().length > 0
        ? eventFields.viewerGivenName.trim()
        : undefined,
    hostInvite:
      rawHostInvite &&
      typeof rawHostInvite.token === "string" &&
      rawHostInvite.token.length > 0 &&
      typeof rawHostInvite.remaining === "number"
        ? {
            token: rawHostInvite.token,
            remaining: Math.max(0, rawHostInvite.remaining),
            conversions: Array.isArray(rawHostInvite.conversions)
              ? rawHostInvite.conversions
                  .filter(
                    (c): c is InviteLinkConversion =>
                      Boolean(c) &&
                      typeof c === "object" &&
                      typeof (c as InviteLinkConversion).orderId === "string" &&
                      typeof (c as InviteLinkConversion).givenName ===
                        "string" &&
                      typeof (c as InviteLinkConversion).familyName ===
                        "string" &&
                      typeof (c as InviteLinkConversion).tierName ===
                        "string" &&
                      typeof (c as InviteLinkConversion).registeredAt ===
                        "string",
                  )
                  .map((c) => ({
                    orderId: c.orderId,
                    givenName: c.givenName.trim(),
                    familyName: c.familyName.trim(),
                    tierName: c.tierName,
                    registeredAt: c.registeredAt,
                  }))
              : [],
          }
        : undefined,
  };
}

export type CheckoutIntentResponse = {
  orderId: string;
  returnUrl: string;
  requiresPayment: boolean;
  amountCents: number;
  clientSecret?: string;
};

export type CheckoutPricingPreviewResponse = {
  amountCents: number;
  subtotalCents: number;
  discountCents: number;
};

export async function previewEventCheckoutPricing(body: {
  slug: string;
  exclusiveTierId: string;
  addonTierIds: string[];
  promotionCode: string | null;
}): Promise<CheckoutPricingPreviewResponse> {
  const { data } = await eventsClient.post<CheckoutPricingPreviewResponse>(
    "/checkout/pricing-preview",
    body,
  );

  return data;
}

export async function createEventCheckoutIntent(body: {
  slug: string;
  email: string | null;
  locale: "de" | "en" | "it";
  phoneE164: string | null;
  inviteToken: string | null;
  exclusiveTierId: string;
  addonTierIds: string[];
  returnPath: string | null;
  promotionCode?: string | null;
}): Promise<CheckoutIntentResponse> {
  const { data } = await eventsClient.post<CheckoutIntentResponse>(
    "/checkout/intent",
    body,
  );

  return data;
}

export type CheckoutConfirmResult = { ok: true };

/** Confirm checkout after Stripe payment; webhook reconciles the same order idempotently. */
export async function confirmEventCheckout(
  orderId: string,
): Promise<CheckoutConfirmResult> {
  await eventsClient.post("/checkout/confirm", { orderId });

  return { ok: true };
}

export async function exchangeRegistrationSessionCode(
  code: string,
): Promise<void> {
  await eventsClient.post("/registrations/session/exchange", { code });
}

export async function endParticipantSession(): Promise<void> {
  await eventsClient.post("/registrations/session/logout");
}

/** `GET /registrations/session/me` — session flag and display names for the events UI. */
export async function fetchParticipantSessionStatus(): Promise<{
  session: boolean;
  givenName?: string;
  familyName?: string;
}> {
  if (!EVENTS_API_URL) {
    return { session: false };
  }
  try {
    const { data } = await eventsClient.get<{
      session?: boolean;
      givenName?: string;
      familyName?: string;
    }>("/registrations/session/me");

    const trimName = (value: unknown) =>
      typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;

    return {
      session: Boolean(data.session),
      givenName: trimName(data.givenName),
      familyName: trimName(data.familyName),
    };
  } catch {
    return { session: false };
  }
}

export async function requestRegistrationSessionLink(body: {
  contact: string;
  locale: "de" | "en" | "it";
  returnUrl: string;
}): Promise<"email" | "sms"> {
  const { data } = await eventsClient.post<{
    sent: boolean;
    channel: "email" | "sms";
  }>("/registrations/session/request", {
    contact: body.contact,
    locale: body.locale,
    returnUrl: body.returnUrl,
  });

  return data.channel ?? "email";
}

export async function establishAnonymousSession(body: {
  inviteToken?: string | null;
}): Promise<ParticipantProfile> {
  const { data } = await eventsClient.post<ParticipantProfile>(
    "/registrations/session/anonymous",
    { inviteToken: body.inviteToken ?? null },
  );

  return data;
}

export async function fetchParticipantProfile(): Promise<ParticipantProfile | null> {
  if (!EVENTS_API_URL) {
    return null;
  }
  try {
    const { data } = await eventsClient.get<ParticipantProfile>(
      "/registrations/profile/me",
    );

    return {
      ...data,
      inviteFlow: Boolean(data.inviteFlow),
    };
  } catch {
    return null;
  }
}

export async function updateParticipantProfile(body: {
  givenName: string;
  familyName: string;
  email: string | null;
  phoneE164: string | null;
}): Promise<ParticipantProfile> {
  const { data } = await eventsClient.put<ParticipantProfile>(
    "/registrations/profile",
    body,
  );

  return data;
}

export async function requestProfileVerification(body: {
  channel: "email" | "phone";
  locale: "de" | "en" | "it";
}): Promise<"email" | "phone"> {
  const { data } = await eventsClient.post<{
    sent: boolean;
    channel: "email" | "phone";
  }>("/registrations/profile/verification/request", body);

  return data.channel ?? body.channel;
}

export async function confirmProfileVerification(body: {
  code: string;
}): Promise<ParticipantProfile> {
  const { data } = await eventsClient.post<ParticipantProfile>(
    "/registrations/profile/verification/confirm",
    body,
  );

  return data;
}
