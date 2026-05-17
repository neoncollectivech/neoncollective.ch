import * as functions from "@google-cloud/functions-framework";
import { getRequestListener } from "@hono/node-server";
import { arktypeValidator } from "@hono/arktype-validator";
import {
  createCorsFromEnv,
  createHttpJsonErrorHandler,
  createHttpRequestLogger,
  createLogger,
} from "@neon/server-kit";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { isDatabaseConfigured, getDb } from "./db/index.js";
import { events } from "./db/schema.js";
import {
  anonymousSessionSchema,
  checkInSchema,
  checkoutIntentSchema,
  checkoutConfirmSchema,
  profileUpdateSchema,
  profileVerificationConfirmSchema,
  profileVerificationRequestSchema,
  sessionExchangeSchema,
  sessionPhoneSchema,
  sessionRequestSchema,
} from "./schemas.js";
import { createAdminRouter } from "./admin/router.js";
import {
  buildEventPayload,
  findInviteLinkByRawToken,
  findPaidRegistrationForViewer,
  findRosterInviteeByPersonId,
  getInviteRedemptionQty,
  getHostInviteShareForViewer,
  listPublishedEventsCatalog,
  eventIdForInviteLinkId,
  inviteRemainingForLink,
  resolveInviteEventId,
} from "./services/event-read.js";
import { confirmEventCheckout } from "./services/checkout-confirm.js";
import { createCheckoutIntent } from "./services/checkout-intent.js";
import {
  confirmProfileVerification,
  getParticipantProfile,
  requestProfileVerification,
  updateParticipantProfile,
} from "./services/participant-profile.js";
import { checkInAdmission, verifyStaffBearer } from "./services/checkin-refund.js";
import { attachPhoneToPerson } from "./services/people.js";
import {
  createAnonymousParticipantSession,
  exchangeRegistrationCode,
  requestRegistrationSession,
  resolveParticipantIdentityFromCookie,
  resolveParticipantSessionFromCookie,
  resolveParticipantSessionCookieCrossSite,
} from "./services/registration-session.js";
import { normalizeOptionalPhoneE164 } from "./contact.js";
import { handleStripeWebhook } from "./services/stripe-webhook.js";

const log = createLogger("http");

/** Sliding-window limit for exchange attempts per client IP (6-char codes). */
const exchangeRateTimestamps = new Map<string, number[]>();
const EXCHANGE_RATE_WINDOW_MS = 15 * 60 * 1000;
const EXCHANGE_RATE_MAX_ATTEMPTS = 30;

function clientIpForRateLimit(c: { req: { header: (n: string) => string | undefined } }): string {
  const xff = c.req.header("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return c.req.header("cf-connecting-ip") ?? "unknown";
}

function consumeExchangeRateLimit(ip: string): boolean {
  const now = Date.now();
  let arr = exchangeRateTimestamps.get(ip) ?? [];
  arr = arr.filter((t) => now - t < EXCHANGE_RATE_WINDOW_MS);
  if (arr.length >= EXCHANGE_RATE_MAX_ATTEMPTS) {
    exchangeRateTimestamps.set(ip, arr);
    return false;
  }
  arr.push(now);
  exchangeRateTimestamps.set(ip, arr);
  return true;
}

const app = new Hono();

app.use("*", createCorsFromEnv("credentials"));
app.use("*", createHttpRequestLogger(log));
app.onError(createHttpJsonErrorHandler(log));

app.route("/admin", createAdminRouter());

app.get("/health", (c) => {
  return c.json({
    ok: true,
    database: isDatabaseConfigured(),
  });
});

/** Published catalog: public events + invite-only rows for roster / guest invite. */
app.get("/events", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json({ events: [] });
  }
  const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
  const inviteQ = c.req.query("invite");
  const inviteEventId = await resolveInviteEventId({
    inviteToken: inviteQ,
    sessionInviteLinkId: session?.inviteLinkId,
  });
  const rows = await listPublishedEventsCatalog({
    viewerPersonId: session?.personId ?? null,
    inviteEventId,
  });
  return c.json({
    events: rows.map((r) => ({
      slug: r.slug,
      title: r.title,
      summary: r.summary,
      location: r.location,
      imageUrls: r.imageUrls,
      startsAt: r.startsAt?.toISOString() ?? null,
      inviteOnly: r.inviteOnly,
    })),
  });
});

app.get("/events/:slug", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json({ error: "Database not configured." }, 503);
  }
  const slug = c.req.param("slug");
  const inviteQ = c.req.query("invite");
  const db = getDb();
  const [evRow] = await db
    .select()
    .from(events)
    .where(and(eq(events.slug, slug), eq(events.status, "published")))
    .limit(1);
  if (!evRow) {
    return c.json({ error: "Event not found." }, 404);
  }

  const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));

  let full = evRow.accessMode === "public";
  let inviteRemaining: number | undefined;
  let access: "full" | "minimal" = full ? "full" : "minimal";

  if (evRow.accessMode === "invite_only") {
    full = false;
    access = "minimal";
    let entitled = false;
    let linkIdForRemaining: string | null = null;
    if (inviteQ) {
      const guest = await findInviteLinkByRawToken(inviteQ);
      if (guest && guest.event.id === evRow.id) {
        entitled = true;
        linkIdForRemaining = guest.link.id;
      }
    }
    if (!entitled && session?.inviteLinkId) {
      const linkEventId = await eventIdForInviteLinkId(session.inviteLinkId);
      if (linkEventId === evRow.id) {
        entitled = true;
        linkIdForRemaining = session.inviteLinkId;
      }
    }
    if (!entitled && session?.personId) {
      const roster = await findRosterInviteeByPersonId(evRow.id, session.personId);
      if (roster && roster !== "ambiguous") {
        entitled = true;
      }
      if (!entitled) {
        const reg = await findPaidRegistrationForViewer(evRow.id, session.personId);
        if (reg) {
          entitled = true;
        }
      }
    }
    if (entitled) {
      full = true;
      access = "full";
      if (linkIdForRemaining) {
        inviteRemaining = await inviteRemainingForLink(linkIdForRemaining);
      }
    }
  } else {
    access = full ? "full" : "minimal";
  }

  const payload = await buildEventPayload(slug, full ? "full" : "minimal", {
    inviteRemaining,
  });
  if (!payload) {
    return c.json({ error: "Event not found." }, 404);
  }

  let registrationConfirmed = false;
  let registeredTierName: string | undefined;
  let viewerGivenName: string | undefined;
  let hostInvite:
    | {
        token: string;
        remaining: number;
        conversions: {
          orderId: string;
          givenName: string;
          familyName: string;
          tierName: string;
          registeredAt: string;
        }[];
      }
    | undefined;
  if (session?.personId) {
    const reg = await findPaidRegistrationForViewer(evRow.id, session.personId);
    if (reg) {
      registrationConfirmed = true;
      registeredTierName = reg.tierName;
    }
    if (registrationConfirmed && evRow.accessMode === "invite_only") {
      const share = await getHostInviteShareForViewer(evRow.id, session.personId);
      if (share) {
        viewerGivenName = share.givenName;
        hostInvite = {
          token: share.inviteToken,
          remaining: share.inviteRemaining,
          conversions: share.conversions,
        };
      }
    }
  }

  return c.json({
    ...payload,
    access,
    registrationConfirmed,
    ...(registeredTierName ? { registeredTierName } : {}),
    ...(viewerGivenName ? { viewerGivenName } : {}),
    ...(hostInvite ? { hostInvite } : {}),
  });
});

app.get("/invites/resolve", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json({ error: "Database not configured." }, 503);
  }
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "Missing token." }, 400);
  }
  const row = await findInviteLinkByRawToken(token);
  if (!row || row.event.accessMode !== "invite_only") {
    return c.json({ error: "Invalid invite." }, 404);
  }
  const used = await getInviteRedemptionQty(row.link.id);
  return c.json({
    eventSlug: row.event.slug,
    hostGivenName: row.inviter?.givenName?.trim() ?? "NEON",
    remainingRedemptions: Math.max(0, row.link.maxRedemptions - used),
    inviteOnly: true,
  });
});

app.post(
  "/checkout/intent",
  arktypeValidator("json", checkoutIntentSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const body = c.req.valid("json");
    const res = await createCheckoutIntent({
      slug: body.slug,
      email: body.email,
      locale: body.locale,
      phoneE164: body.phoneE164,
      inviteToken: body.inviteToken,
      tierId: body.tierId,
      cookieHeader: c.req.header("Cookie"),
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json({ clientSecret: res.clientSecret, orderId: res.orderId });
  },
);

app.post(
  "/checkout/confirm",
  arktypeValidator("json", checkoutConfirmSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const body = c.req.valid("json");
    const res = await confirmEventCheckout({
      orderId: body.orderId,
      cookieHeader: c.req.header("Cookie"),
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json({ ok: true });
  },
);

app.post("/webhooks/stripe", async (c) => {
  const sig = c.req.header("stripe-signature");
  const raw = await c.req.text();
  const res = await handleStripeWebhook(raw, sig);
  if (!res.ok) {
    return c.text(res.error, res.status as ContentfulStatusCode);
  }
  return c.json({ received: true });
});

/** Participant session: validity + display names for the events UI (when not generic Guest/Customer). */
app.get("/registrations/session/me", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json({ session: false });
  }
  const identity = await resolveParticipantIdentityFromCookie(c.req.header("Cookie"));
  if (!identity?.personId) {
    return c.json({ session: false });
  }
  return c.json({
    session: true,
    ...(identity.givenName ? { givenName: identity.givenName } : {}),
    ...(identity.familyName ? { familyName: identity.familyName } : {}),
  });
});

app.post(
  "/registrations/session/request",
  arktypeValidator("json", sessionRequestSchema),
  async (c) => {
    const body = c.req.valid("json");
    const res = await requestRegistrationSession({
      contact: body.contact,
      locale: body.locale,
      returnUrl: body.returnUrl,
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json({ sent: true, channel: res.channel });
  },
);

app.post(
  "/registrations/session/exchange",
  arktypeValidator("json", sessionExchangeSchema),
  async (c) => {
    const ip = clientIpForRateLimit(c);
    if (!consumeExchangeRateLimit(ip)) {
      return c.json({ error: "Too many attempts. Try again later." }, 429);
    }
    const body = c.req.valid("json");
    const crossSite = resolveParticipantSessionCookieCrossSite({
      originHeader: c.req.header("Origin"),
      requestUrl: c.req.url,
    });
    const res = await exchangeRegistrationCode({
      code: body.code,
      crossSiteCookie: crossSite,
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    c.header("Set-Cookie", res.setCookie);
    return c.json({ ok: true });
  },
);

app.post(
  "/registrations/session/anonymous",
  arktypeValidator("json", anonymousSessionSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const body = c.req.valid("json");
    const crossSite = resolveParticipantSessionCookieCrossSite({
      originHeader: c.req.header("Origin"),
      requestUrl: c.req.url,
    });
    const res = await createAnonymousParticipantSession({
      inviteToken: body.inviteToken,
      crossSiteCookie: crossSite,
      cookieHeader: c.req.header("Cookie"),
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    if (res.setCookie) {
      c.header("Set-Cookie", res.setCookie);
    }
    const profile = await getParticipantProfile(res.session);
    return c.json({
      anonymous: res.session.personId == null,
      created: res.created,
      ...profile,
    });
  },
);

app.get("/registrations/profile/me", async (c) => {
  if (!isDatabaseConfigured()) {
    return c.json({ error: "Database not configured." }, 503);
  }
  const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
  if (!session) {
    return c.json({ error: "Session required." }, 401);
  }
  const profile = await getParticipantProfile(session);
  return c.json(profile);
});

app.put(
  "/registrations/profile",
  arktypeValidator("json", profileUpdateSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    if (!session) {
      return c.json({ error: "Session required." }, 401);
    }
    const body = c.req.valid("json");
    const res = await updateParticipantProfile({
      session,
      givenName: body.givenName,
      familyName: body.familyName,
      email: body.email,
      phoneE164: body.phoneE164,
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json(res.profile);
  },
);

app.post(
  "/registrations/profile/verification/request",
  arktypeValidator("json", profileVerificationRequestSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    if (!session) {
      return c.json({ error: "Session required." }, 401);
    }
    const body = c.req.valid("json");
    const ip = clientIpForRateLimit(c);
    if (!consumeExchangeRateLimit(ip)) {
      return c.json({ error: "Too many attempts. Try again later." }, 429);
    }
    const res = await requestProfileVerification({
      session,
      channel: body.channel,
      locale: body.locale,
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json({ sent: true, channel: res.channel });
  },
);

app.post(
  "/registrations/profile/verification/confirm",
  arktypeValidator("json", profileVerificationConfirmSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const session = await resolveParticipantSessionFromCookie(c.req.header("Cookie"));
    if (!session) {
      return c.json({ error: "Session required." }, 401);
    }
    const body = c.req.valid("json");
    const ip = clientIpForRateLimit(c);
    if (!consumeExchangeRateLimit(ip)) {
      return c.json({ error: "Too many attempts. Try again later." }, 429);
    }
    const res = await confirmProfileVerification({ session, code: body.code });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json(res.profile);
  },
);

app.post(
  "/registrations/profile/phone",
  arktypeValidator("json", sessionPhoneSchema),
  async (c) => {
    if (!isDatabaseConfigured()) {
      return c.json({ error: "Database not configured." }, 503);
    }
    const identity = await resolveParticipantIdentityFromCookie(c.req.header("Cookie"));
    if (!identity?.personId) {
      return c.json({ error: "Unauthorized." }, 401);
    }
    const body = c.req.valid("json");
    const e164 = normalizeOptionalPhoneE164(body.phoneE164);
    if (!e164) {
      return c.json({ error: "Invalid phone number." }, 400);
    }
    const res = await attachPhoneToPerson({
      personId: identity.personId,
      phoneE164: e164,
    });
    if (!res.ok) {
      if (res.code === "not_found") {
        return c.json({ error: "Profile not found." }, 404);
      }
      return c.json(
        { error: "This phone number is already linked to another profile." },
        409 as ContentfulStatusCode,
      );
    }
    return c.json({ ok: true });
  },
);

app.post(
  "/check-in",
  arktypeValidator("json", checkInSchema),
  async (c) => {
    const staff = process.env.STAFF_CHECKIN_TOKEN;
    if (!verifyStaffBearer(c.req.header("Authorization"), staff)) {
      return c.json({ error: "Unauthorized." }, 401);
    }
    const body = c.req.valid("json");
    const res = await checkInAdmission({
      token: body.token,
      staffLabel: "staff",
    });
    if (!res.ok) {
      return c.json({ error: res.error }, res.status as ContentfulStatusCode);
    }
    return c.json({ ok: true });
  },
);

functions.http("eventsApi", getRequestListener(app.fetch));

export default app;
