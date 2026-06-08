# NEON Door (`@neon/door`)

Field PWA for QR admission check-in (`POST /check-in`) and on-site POS sales (`/pos/*`) via SumUp Cloud API + Solo readers.

**Scan** and **POS** are separate views (bottom tab bar). API key, event, Solo reader, and scan feedback settings persist in **localStorage**. Offline check-ins use IndexedDB (`neon-door`); POS requires network.

## POS (SumUp Solo)

1. Configure `events-api` with sandbox `SUMUP_API_KEY`, `SUMUP_MERCHANT_CODE`, `SUMUP_AFFILIATE_KEY`, `SUMUP_APP_ID` (see `functions/events-api/.env.example`). Create the API key under Developer Settings → Sandboxes for your test merchant (`SUMUP_MERCHANT_CODE`, e.g. `MADADSWC`). `/me` may still show your live merchant — that is normal; reader API calls use `SUMUP_MERCHANT_CODE`.
2. Pair Virtual Solo in Door POS (pairing form) or via Cloud API. Open [Virtual Solo](https://virtual-solo.sumup.com/), copy the pairing code, pair, then **keep that tab open** until reader status is **ONLINE**.
3. In Door **POS**, pick the paired reader, select a guest (search, scan admission QR, or enter contact details), then choose what to sell — admission + add-ons for new guests, or add-ons only when the guest already has admission.
4. Tap **Charge on Solo** — guest pays on the WiFi/cellular terminal; Door polls until paid and shows the admission QR.

Webhook: set SumUp checkout `return_url` to `{EVENTS_API_PUBLIC_URL}/pos/webhooks/sumup` (configured automatically when `EVENTS_API_PUBLIC_URL` is set). Optional `SUMUP_WEBHOOK_SECRET` verifies `x-payload-signature`.

## Local development

```bash
# From repo root (starts events-api :8082 and door :5174 among other apps)
pnpm dev:apps

# Door only (requires events-api running on 8082)
pnpm --filter @neon/door dev
```

Open http://localhost:5174 (or your machine’s LAN IP on port 5174 — dev server binds `0.0.0.0`) — paste an event API key from [NEON Admin](http://localhost:5173) → API Keys.

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
