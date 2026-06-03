# NEON Door (`@neon/door`)

Field PWA for fast QR admission check-in against `events-api` `POST /check-in`.

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

## GitHub Pages (`/door/`)

Production deploy merges `apps/door/dist` into `apps/web/out/door/` in [`.github/workflows/nextjs.yml`](../../.github/workflows/nextjs.yml) (same pattern as admin at `/admin/`). After merging to `main`, Pages serves https://neoncollective.ch/door/.
