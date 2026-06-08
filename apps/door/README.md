# NEON Door (`@neon/door`)

Field PWA for QR admission check-in (`POST /check-in`) and on-site POS sales (`/pos/*`) via SumUp Cloud API + Solo readers, with **Tap to Pay** (SumUp Payment Switch) as a phone fallback.

**Scan** and **POS** are separate views (bottom tab bar). API key, event, payment method (Solo reader or Tap to Pay), and scan feedback settings persist in **localStorage**. Offline check-ins use IndexedDB (`neon-door`); POS requires network.

## POS (SumUp)

### Solo reader (primary)

1. Configure `events-api` with `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SUMUP_AFFILIATE_KEY`, `SUMUP_APP_ID` (see `functions/events-api/.env.example`). Create the API key under Developer Settings → Sandboxes for your test merchant (`SUMUP_MERCHANT_CODE`, e.g. `MADADSWC`). `/me` may still show your live merchant — that is normal; reader API calls use `SUMUP_MERCHANT_CODE`.
2. Pair a physical Solo in Door POS (**Pair new reader** → pairing code from the terminal).
3. In Door **POS**, pick the reader (or **Use Tap to Pay**), select a guest (search, scan admission QR, or enter contact details), choose tiers, then **Charge on reader**.
4. Guest pays on the terminal; Door polls until paid and shows **Sale complete** (admission is created/updated server-side — no QR on Door).

Webhook: SumUp checkout `return_url` is `{EVENTS_API_PUBLIC_URL}/pos/webhooks/sumup` when `EVENTS_API_PUBLIC_URL` is set. Optional `SUMUP_WEBHOOK_SECRET` verifies `x-payload-signature`.

### Tap to Pay (SumUp app handoff)

Fallback when no Solo is available. Requires on `events-api`:

- `SUMUP_APP_SWITCH_CALLBACK_BASE` — HTTPS URL without query string, e.g. `https://neoncollective.ch/door/pos`
- Optional `SUMUP_APP_SWITCH_ANDROID_APP_ID` (defaults to `SUMUP_APP_ID`)

SumUp merchant app must be installed and logged in on the door device.

**SumUp dashboard** (Profile → Developers): whitelist app IDs for your affiliate key:

- `com.apple.mobilesafari`
- `com.sumup.appswitch`
- PWA standalone bundle ID — contact `integration@sumup.com` if launching SumUp from the installed Door PWA fails

**Staff workflow (iPhone PWA):** Select **Use Tap to Pay** → guest → tiers → **Continue to SumUp** → **Open SumUp** → pay in SumUp app → **switch back to the NEON Door home-screen icon** → wait for **Sale complete**. Do not rely on automatic return from SumUp on iOS installed PWA (Safari callback may lack Door session).

Payment Switch is legacy; poll + `POST /pos/sale/:id/confirm-app-switch` are required for reliable confirmation.

## Local development

```bash
# From repo root (starts events-api :8082 and door :5174 among other apps)
pnpm dev:apps

# Door only (requires events-api running on 8082)
pnpm --filter @neon/door dev
```

Open http://localhost:5174 (or your machine’s LAN IP on port 5174 — dev server binds `0.0.0.0`) — paste an event API key from [NEON Admin](http://localhost:5173) → API Keys.

For Tap to Pay device testing, `SUMUP_APP_SWITCH_CALLBACK_BASE` can point at ngrok/LAN HTTPS; note iOS PWA vs Safari storage behavior.

## Environment

See [`.env.example`](./.env.example). Production builds use `VITE_DOOR_BASE=/door/` and `VITE_EVENTS_API_URL` pointing at the deployed `neo-events-api` root.

## Build

```bash
pnpm --filter @neon/door build
```

Installable PWA output is in `apps/door/dist/` (service worker + self-hosted `zxing_reader.wasm`).

After a deploy, open the app and use **Settings → Check for updates** (or accept the **Update now** toast when a new version is ready). Uninstall is not required.

### Install on iPhone (iOS)

iOS does **not** show a Chrome-style install prompt. In **Safari**, open `https://neoncollective.ch/door/`, tap **Share** (□↑), then **Add to Home Screen**. Use the home-screen icon (not a Safari tab) at the door. The in-app banner on setup repeats these steps.

## GitHub Pages (`/door/`)

Production deploy merges `apps/door/dist` into `apps/web/out/door/` in [`.github/workflows/nextjs.yml`](../../.github/workflows/nextjs.yml) (same pattern as admin at `/admin/`). After merging to `main`, Pages serves https://neoncollective.ch/door/.
