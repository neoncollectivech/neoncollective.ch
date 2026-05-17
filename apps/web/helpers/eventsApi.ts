import { createPublicApiClient } from "./createPublicApiClient";

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
  imageUrls: string[];
  startsAt: string | null;
  accessMode: "public" | "invite_only";
  inviteOnly: boolean;
  access?: "full" | "minimal";
  inviteRemaining?: number;
  tiers?: EventTier[];
  /** True when the session cookie matches a person with a paid order for this event. */
  registrationConfirmed?: boolean;
  registeredTierName?: string;
  /** Roster host first name when registration is confirmed on invite-only events. */
  viewerGivenName?: string;
  /** Guest invite link for roster hosts (session + paid registration). */
  hostInvite?: {
    token: string;
    remaining: number;
    conversions: InviteLinkConversion[];
  };
};

export type InviteLinkConversion = {
  orderId: string;
  givenName: string;
  familyName: string;
  tierName: string;
  registeredAt: string;
};

/** Catalog row from `GET /events` (public + invite-only when session matches roster). */
export type EventCatalogItem = {
  slug: string;
  title: string;
  summary: string | null;
  location: string | null;
  imageUrls: string[];
  startsAt: string | null;
  inviteOnly: boolean;
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
          imageUrls: Array.isArray(e.imageUrls)
            ? e.imageUrls.filter(
                (u): u is string =>
                  typeof u === "string" && u.trim().length > 0,
              )
            : [],
          startsAt: e.startsAt ?? null,
          inviteOnly: Boolean(e.inviteOnly),
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

  const imageUrls = Array.isArray(data.imageUrls)
    ? data.imageUrls.filter(
        (u): u is string => typeof u === "string" && u.trim().length > 0,
      )
    : [];

  const tiers = Array.isArray(data.tiers)
    ? data.tiers.map((tier) => ({
        ...tier,
        selectionMode:
          tier.selectionMode === "addon" ? ("addon" as const) : ("exclusive" as const),
      }))
    : undefined;

  return {
    ...data,
    summary: data.summary ?? null,
    location: data.location ?? null,
    imageUrls,
    tiers,
    registrationConfirmed: Boolean(data.registrationConfirmed),
    registeredTierName:
      typeof data.registeredTierName === "string" &&
      data.registeredTierName.trim().length > 0
        ? data.registeredTierName.trim()
        : undefined,
    viewerGivenName:
      typeof data.viewerGivenName === "string" &&
      data.viewerGivenName.trim().length > 0
        ? data.viewerGivenName.trim()
        : undefined,
    hostInvite:
      data.hostInvite &&
      typeof data.hostInvite.token === "string" &&
      data.hostInvite.token.length > 0 &&
      typeof data.hostInvite.remaining === "number"
        ? {
            token: data.hostInvite.token,
            remaining: Math.max(0, data.hostInvite.remaining),
            conversions: Array.isArray(data.hostInvite.conversions)
              ? data.hostInvite.conversions
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

export async function createEventCheckoutIntent(body: {
  slug: string;
  email: string | null;
  locale: "de" | "en" | "it";
  phoneE164: string | null;
  inviteToken: string | null;
  exclusiveTierId: string;
  addonTierIds: string[];
}): Promise<{ clientSecret: string; orderId: string }> {
  const { data } = await eventsClient.post<{
    clientSecret: string;
    orderId: string;
  }>("/checkout/intent", body);

  return data;
}

/** Confirm checkout after Stripe payment; webhook reconciles the same order idempotently. */
export async function confirmEventCheckout(orderId: string): Promise<void> {
  await eventsClient.post("/checkout/confirm", { orderId });
}

export async function exchangeRegistrationSessionCode(
  code: string,
): Promise<void> {
  await eventsClient.post("/registrations/session/exchange", { code });
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

/** Requires participant session cookie set by successful `/registrations/session/exchange`. */
export async function attachRegistrationProfilePhone(body: {
  phoneE164: string;
}): Promise<void> {
  await eventsClient.post("/registrations/profile/phone", body);
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
