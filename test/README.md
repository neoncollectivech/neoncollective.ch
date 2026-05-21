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

## What the invite checkout spec covers

**Serial** tests in `test/web/checkout-invite-flow.spec.mjs` (two nested describes):

**Person A (host on guest list):** sign-in → **minimal checkout** (exclusive **Guest** + add-on **Bar package**, total CHF 23) → pay → confirmed → host invite link

**Person B (guest link):** fresh browser → profile + verify → same tier/add-on checkout → pay → confirmed (no “Invite guests”) → API has no `hostInvite`

**Person A (after B):** reload private dossier → **Registered via your link** lists Person B (name + `Guest + Bar package` tiers) → API `hostInvite.conversions` matches

Seed (`db:seed:e2e`) creates one exclusive tier (CHF 15) and one add-on tier (CHF 8). Tests select both and assert the combined total before payment.

Minimal checkout means tier/add-on pickers + **Continue to payment** only — no inline email/phone fields and no “Welcome back” sign-in block under checkout.
