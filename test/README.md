# E2E tests (Playwright)

Monorepo-wide browser tests live under `test/`. Web checkout specs are in `test/web/`.

## Prerequisites

1. **Node 22** and **pnpm** (repo root).
2. **`functions/events-api/.env.local`** with at least:
   - `DATABASE_URL`
   - `STRIPE_SECRET_KEY` (test mode)
   - `STRIPE_WEBHOOK_SECRET` (optional for client confirm path; webhook still recommended)
   - `EVENTS_ALLOWED_ORIGIN=http://localhost:3000`
   - `PUBLIC_SITE_URL=http://localhost:3000`
3. **`apps/web/.env.local`** with:
   - `NEXT_PUBLIC_EVENTS_API_URL=http://localhost:8082`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (test `pk_…`, same account as `STRIPE_SECRET_KEY`)
   - `NEXT_PUBLIC_SITE_URL=http://localhost:3000`
4. **Stripe CLI** (recommended): in a separate terminal:
   ```bash
   pnpm stripe:listen
   ```

## E2E test mode (no SMS / email)

`events-api` must run with `E2E_TEST_MODE=1` (OTP `EEEEEE`). Twilio and Resend are not required.

- `pnpm test:e2e` starts the API with that flag via Playwright `webServer`.
- If you use `PLAYWRIGHT_SKIP_WEBSERVER=1`, start **`pnpm dev:e2e`** (not plain `pnpm dev`) so Person B profile verification accepts `EEEEEE`.

## Install browsers

```bash
pnpm test:e2e:install
```

## Ports (3000 + 8082)

E2E and `dev:e2e` expect **exactly**:

| Service     | Port |
|------------|------|
| `@neon/web` | 3000 |
| `@neon/events-api` | 8082 |

If you see `EADDRINUSE`, port 3000 → 3001, or `.next/dev/lock`, a previous `pnpm dev`, `pnpm test:e2e`, or Playwright left processes running.

**Fix — free the ports, then start once:**

```bash
pnpm e2e:free-ports
pnpm dev:e2e
```

Do **not** run `pnpm dev:e2e` and `pnpm test:e2e` at the same time (both try to own the same ports). Pick one:

- **Option A — tests start servers:** `pnpm test:e2e` only  
- **Option B — you start dev, then test/UI:** `pnpm dev:e2e` then `pnpm test:e2e:ui` or `PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e:headed`

## Run checkout E2E

```bash
pnpm e2e:free-ports   # if you had a stuck dev / test run
pnpm test:e2e
```

Playwright starts `@neon/web` and `@neon/events-api` on those ports (same as dev).

### Watch tests in the browser

**Playwright UI** — dev must already be up on **3000** and **8082**:

```bash
pnpm e2e:free-ports
pnpm dev:e2e
# wait until http://localhost:3000 loads

pnpm test:e2e:ui
```

**Headed:**

```bash
pnpm test:e2e:headed
```

Every test run reseeds the DB first (`global-setup.mjs` → `pnpm db:events-api:seed:e2e`).

## Stripe test card (CHF checkout)

Checkout E2E fills the Payment Element with Stripe’s **Switzerland Visa** test PAN `4000007560000009` (exp `12/34`, CVC `123`). It succeeds for CHF amounts on your test account — same as a real CHF event checkout.

## Payment flow (matches production)

The fixtures mirror what the site does in `event-details.tsx` + `useCheckoutConfirmation`:

1. **Continue to payment** — `POST /checkout/intent` with `returnPath` (current dossier URL), tier ids, and `returnUrl` in the response.
2. **Stripe Payment Element** — wait for the iframe, fill card fields, ensure **Pay now** is enabled (Stripe.js loaded).
3. **Pay now** — browser `stripe.confirmPayment` with `redirect: "if_required"` and server `returnUrl` (no server-side `paymentIntents.confirm` shortcut).
4. **Confirming your payment…** — UI shows while the client polls.
5. **`POST /checkout/confirm`** — Playwright waits for HTTP 200 `{ ok: true }` (same as `eventsApi.checkout.confirmPoll`).
6. **`GET /events/:slug`** — wait until `registrationConfirmed: true` (registration poll).
7. **You're registered** — heading visible.

Run **`pnpm stripe:listen`** in a separate terminal so webhook fulfillment also runs (idempotent with client confirm; closer to production).

Fixtures: `startCheckoutPaymentStep`, `submitStripePaymentAndConfirmRegistration`, `completeEventCheckout` in `test/fixtures/checkout.mjs`.

## What the invite checkout spec covers

**Serial** tests in `test/web/checkout-invite-flow.spec.mjs` (two nested describes):

**Person A (host on guest list):** sign-in → **minimal checkout** (exclusive **Root** + **Addon 1**, total CHF 23) → pay → confirmed → host invite link

**Person B (guest link):** fresh browser → profile + verify → same tier/add-on checkout → **abandon Stripe step and retry intent** (host link `maxRedemptions: 1`; pending must not block the same guest) → pay → confirmed (no “Bring your friends”) → API has no `hostInvite`

**Person A (after B):** reload private dossier → **Registered via your link** lists Person B (name + `Guest + Bar package` tiers) → API `hostInvite.conversions` matches

Seed (`db:seed:e2e`) creates **Root** (CHF 15, mandatory), **Addon 1** (CHF 8), and **Addon 2** (CHF 5). Invite checkout uses Root + Addon 1 (CHF 23). Promo code `E2ETIER` sets Root and Addon 1 to 0; with all three tiers selected the cart totals Addon 2 only (CHF 5); Root + Addon 1 checkout is free.

### E2E personas (distinct phones)

| Persona | On guest list | Spec | Default phone |
|--------|----------------|------|----------------|
| **Host Invited** | yes | `checkout-invite-flow` (Person A) | `+41791234567` |
| **Guest Invited** | no (via host link) | `checkout-invite-flow` (Person B) | `+41791234568` |
| **Host InvitedPromo** | yes | `checkout-promotion` (100% promo, no Stripe) | `+41791234569` |

Override with `E2E_HOST_INVITED_PHONE`, `E2E_GUEST_INVITED_PHONE`, `E2E_HOST_INVITED_PROMO_PHONE` (and optional `*_EMAIL` for hosts). Seed JSON uses `hostInvited`, `guestInvited`, `hostInvitedPromo` objects.

Minimal checkout means tier/add-on pickers + **Continue to payment** only — no inline email/phone fields and no “Welcome back” sign-in block under checkout.

**Promotion spec** uses `createIsolatedContext` (fresh browser, no participant cookie) and **Host InvitedPromo** so it never reuses Host Invited’s session or registration.
