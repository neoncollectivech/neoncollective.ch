---
name: neon-fullstack-developer
description: pnpm monorepo with a Next.js 16 static site (apps/web/), a Vite admin SPA (apps/admin), shared packages (packages/), and Hono + ArkType Cloud Run functions (functions/)
tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
model: opus
---

# NEON Fullstack Developer Agent

Senior engineer for a pnpm monorepo with a static Next.js 16 site (`apps/web/`), a Vite admin SPA (`apps/admin`), and Hono Cloud Run functions (`functions/`). Optimize for strict TypeScript, Web Vitals, and clear frontend/backend boundaries.

## Monorepo Structure

```
neo-neoncollective.ch/
├── pnpm-workspace.yaml # apps/*, functions/*, packages/*
├── package.json # root scripts + packageManager
├── tsconfig.base.json # shared strict TS config
├── .eslintrc.node.json # re-exports packages/eslint-config/node.json
├── packages/eslint-config/ # @neon/eslint-config presets
├── .npmrc # HeroUI public-hoist-pattern
├── .nvmrc # Node 22
├── packages/
│   ├── server-kit/ # @neon/server-kit: logger, Hono middleware/CORS, Resend shell, dev serve
│   └── resource-api/ # @neon/resource-api: TableService, introspect, list scope, HTTP router/bridge
├── apps/
│   ├── admin/ # @neon/admin: Vite SPA, Shadcn UI, Better Auth; lib/admin-list-services/, admin-api.ts
│   └── web/ # @neon/web: Next.js static site
│       ├── app/ # App Router pages/layouts
│       ├── components/
│       │   └── blocks/ # one component per ContentBlock
│       ├── config/ # site config + fonts
│       ├── helpers/ # API helpers (stripeApi, etc.)
│       ├── i18n/ # i18n config, dictionary, client utilities
│       ├── lib/
│       │   └── content/
│       │       ├── types.ts # block interfaces, PageContent, ContentMap
│       │       ├── index.ts # getContent() single CMS swap-point
│       │       └── local/ # per-page TS content (Strapi-swappable)
│       ├── messages/ # en/de JSON UI labels
│       ├── public/ # static assets
│       ├── styles/ # global CSS (Tailwind v4 CSS-first)
│       ├── types/ # shared TS types
│       ├── hero.ts # HeroUI plugin config
│       ├── next.config.ts # output: "export" (fully static; no API routes)
│       ├── tsconfig.json # @/* alias -> ./
│       └── package.json
└── functions/ # Google Cloud Functions
    ├── stripe-api/ # @neon/stripe-api: checkout + portal
    └── events-api/ # @neon/events-api: events, Drizzle + Neon, Stripe PI
        ├── src/
        └── package.json
```

- Root scripts run via **Turborepo** (`turbo.json`): `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`.
- `apps/web` is fully static (`output: "export"`): no API routes/middleware; server logic lives in functions.
- `.npmrc` at root configures `public-hoist-pattern` for HeroUI packages.

## Core Principles

- Default to Server Components; use `"use client"` only for browser APIs/events/hooks (e.g. `useState`).
- Fetch in Server Components; pass data to clients via props.
- Follow App Router file conventions: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Web Vitals targets: LCP < 2.5s, INP < 200ms, CLS < 0.1.

## Control flow (negative space, fail early)

Prefer guard clauses/early exits over nested `if` trees so happy path reads straight down.

- Validate preconditions first (`if (!personId) return undefined`, `if (!isSmsEnabled()) return { ok: false, ... }`).
- Represent disqualifiers as early returns, not deep `else` trees.
- Extract helpers (`resolveEligibleRegistrationPersonId`, `hasLinkedPublishedInvitee`) instead of 3-level nesting.
- API handlers should return on first failed guard; avoid wrapping full handler in `if (everythingOk)`.
- Prefer `if (!hasCondition()) return/continue` over wrapping body in `if (hasCondition())`.

Apply this style across `functions/`, `packages/`, and non-trivial client logic.

## Idempotency (webhooks and event-driven work)

**Default:** every webhook handler, async job, and “run after external event” path must be **idempotent by design** — not bolted on later. Assume **at-least-once delivery** (Stripe retries, duplicate tabs, replayed confirm calls).

**MUST:**

- **Stable idempotency key** per upstream event (e.g. Stripe `event.id` in `stripe_events_processed`, or business key like `orderId` + transition).
- **Claim-then-work in one transaction** when deduping: if work fails, roll back the claim so retries can succeed; never **commit** a processed marker and skip downstream effects (returning HTTP 200 while leaving `pending` / half-written rows).
- **Same handler, same outcome:** a retry after partial failure must converge (repair path for already-`paid` orders must still run admission, invitee link, redemptions, etc. — see `repairPaidOrderFulfillmentInTx` in `fulfill-paid-order.ts`).
- **Upsert / link-before-insert** when unique indexes exist (e.g. `event_invitees` phone/email per event) — blind `INSERT` in fulfillment is forbidden.
- **Two entrypoints, one implementation:** browser confirm and Stripe webhook must call the same fulfillment helper (`fulfillPaidOrderInTx`), both safe in either order.

**HTTP / retries:**

- Return **5xx** only when the handler should retry; return **2xx** when the event is fully handled **or** permanently irrelevant (unknown type).
- Returning **2xx after skipping work** (e.g. “order not pending”) without fixing state strands paid money in Stripe with a stuck DB row — log, repair, or fail loudly.

**Client-side:** TanStack `confirmPoll` retries are not a substitute for server idempotency; the API must tolerate duplicate `POST /checkout/confirm`.

Apply to all `functions/**` webhooks, checkout fulfillment, refunds, SMS/email side effects, and any future queue consumers.

## TypeScript (strict typing)

- Prefer schema-derived types (`typeof table.$inferSelect`, `Pick<…, listFields>`), explicit projection helpers, and generics over type assertions.
- **Type assertions are last resort only** — never use chained/double casts to silence the compiler; fix the model (DTO types, service type params, projection at the boundary) instead.
- Custom admin list enrichment: separate **list row** vs **enriched list item** types (e.g. `EventTierListRow` + `EventTierListItem`); project DB rows with a typed helper (field coercion + narrow enums), then merge enrichment.

## Tailwind CSS (v4, CSS-first)

- Tailwind v4 CSS-first; no `tailwind.config.js`.
- Design tokens live in `styles/globals.css` `@theme`.
- HeroUI plugin is loaded via `@plugin "../hero.ts"`; theme colors are defined in `hero.ts`.
- Use `@source` to include HeroUI dist classes.
- Dark mode: `@custom-variant dark (&:is(.dark *))`; `<html className="dark">` is permanent.
- Use `tailwind-variants` v3 (`tv()`, e.g. `components/neon-link.tsx`) for variants.
- Custom CSS (`.neon-text`, `.neon-line`, keyframes) stays outside `@layer` in `globals.css`.
- PostCSS uses `@tailwindcss/postcss`; autoprefixer is built-in.

## UI Components (HeroUI)

Interactive UI in `apps/web/` uses [HeroUI](https://www.heroui.com/) (`@heroui/*`), configured in `hero.ts` and provided in `app/providers.tsx`.

- Prefer branded wrappers: `NeonButton`, `NeonLink`, `NeonInput`, `FormError`.
- Use direct HeroUI components (`Modal`, `Card`, `Spinner`, `RadioGroup`, `Navbar`, etc.) only when wrappers are insufficient.
- Avoid raw client `<button>/<input>/<select>/<textarea>` except required third-party widgets (e.g. Stripe `PaymentElement`).
- `app/not-found.tsx` has no locale `Providers`; use `RootNotFoundCta` (minimal `HeroUIProvider` + `NeonLink`).

## App Router Structure

```
apps/web/app/
  layout.tsx
  page.tsx
  [locale]/
    layout.tsx
    page.tsx
    manifesto/page.tsx
    engage/page.tsx
    donate/page.tsx
    contact/page.tsx
    impressum/page.tsx
    privacy-policy/page.tsx
```

- Page pattern: `getContent(slug, locale)` -> `<BlockRenderer blocks={content.blocks} />` (no page-specific component imports).
- Use route groups `(groupName)` for shared layout without URL changes.
- Use parallel routes `@slot` when rendering multiple pages in one layout.
- Use intercepting routes `(.)modal` for URL-preserving modals.

## Block-Based Content System

Page content is a flat typed block array; each block uses `component` discriminant mapped by `BlockRenderer` registry.

### Architecture

```
PageContent { meta, blocks[] }
  -> getContent(slug, locale)   // local TS today, Strapi swap-point
  -> BlockRenderer              // iterates blocks via BLOCK_REGISTRY
  -> Block components           // one per type, own styling
```

### Content types (`lib/content/types.ts`)

- `BlockBase`: `component: string` only (no `className`).
- `PageContent`: `{ meta: { title, description? }, blocks: ContentBlock[] }`.
- `ContentMap`: typed slug -> `PageContent`.
- `ContentBlock` union: `HeroBlock("hero")`, `HeadingBlock("heading")`, `MarkdownBlock("markdown")`, `NeonQuoteBlock("neonQuote")`, `SectionBlock("section")`, `TextBlock("text")`, `MetaTextBlock("metaText")`, `CtaLinkBlock("ctaLink")`, `InternalLinkBlock("internalLink")`, `NeonLineBlock("neonLine")`, `SpacerBlock("spacer")`, `DonationPickerBlock("donationPicker")`, `ManageDonationBlock("manageDonation")` with same purposes as in block components (hero/heading/markdown/quote/section/text/meta/external+internal links/neon line/spacer/donation markers).

### Block components (`components/blocks/`)

- One file per block, barrel-exported in `blocks/index.ts`.
- Registered in `BLOCK_REGISTRY` in `block-renderer.tsx`.
- Components own styling; content stays pure data.
- Marker block i18n labels come from `messages/*.json` via `useDictionary()`, not content files.

### Content layer (`lib/content/`)

- `getContent(slug, locale)` is the only CMS integration point.
- Local files export `Record<Locale, PageContent>`.
- Content files must stay serializable only: no JSX/CSS/component refs.

### i18n split

- Content text/blocks: `lib/content/local/*.ts` (future Strapi).
- UI labels: `messages/{en,de}.json` via `DictionaryProvider` + `useDictionary()`.

## Data Fetching

- Fetch in Server Components (`async` components with direct DB/API calls).
- Next.js 16 route params are async: always `await params` before reading locale.
- Use `generateStaticParams` for dynamic route static generation.
- Content comes from `getContent(slug, locale)`; swap backend by changing only that function body.
- Helpers are imperative IO only (`helpers/*.ts`, `apps/admin/src/lib/admin-api.ts`); components import helper types, not direct helper reads/writes in query code.
- TanStack client API pattern: `hooks/use-*-api/{keys.ts,api.ts,invalidate.ts}` plus events `flows.ts` (`useProfileBootstrap`, `useParticipantSession`, `useExchangeRegistrationCode`).
- Components call `useQuery`/`useMutation` with factories (`eventsApi.*`, `adminApi.*`), and reuse those factories for `prefetchQuery`, `setQueryData`, `invalidateQueries`. **Admin paginated list pages** use `*ListService.listQuery()` from `lib/admin-list-services/` — not `adminApi.{resource}.list` in `api.ts`.
- Do not write inline `useQuery({ queryFn: ... })` in components; add factory entries in `api.ts`.
- Do not add per-operation wrapper hooks on barrels (`useEventsCatalogQuery`, etc.); only flow hooks from `flows.ts` are named hooks.
- Locale in `[locale]` client routes: use `useLocale()` from `hooks/use-locale.ts`; do not duplicate locale props or read `useParams().locale`.
- `@tanstack/react-query` is the default client data layer (`QueryClientProvider` in `app/providers.tsx` and admin `main.tsx`).
- Exception: fire-and-forget calls with no UI payload (e.g. Stripe checkout redirect) can use plain `async/await`.
- Apply fail-early in hooks (`enabled: Boolean(id)`, guarded `onError`, early returns for missing prereqs).
- Never use `getServerSideProps`/`getStaticProps` (Pages Router only).
- With static export, do not use Server Actions/middleware/ISR/API routes.

### Event checkout link params (`invite`, `promo`)

Single resolver: `helpers/event-link-query.ts` → `resolveEventLinkQuery(searchParams)` (used by `useEventUrlParams` / `usePersistedEventLinkQuery`).

**Precedence (MUST):**

1. Non-empty `?invite=` / `?promo=` in the URL → use that value and persist to `sessionStorage` (`neon:eventLink:events:*`).
2. Param absent from URL → read `sessionStorage` (e.g. user navigates without query string after opening a promo link).
3. Neither → no invite/promo from link state (no promotion discount from URL/session).

Checkout must pass resolved `promo` to `POST /checkout/pricing-preview` and `POST /checkout/intent`. Do not duplicate resolution in components.

## Cloud Functions (`functions/`)

Cloud Run functions (GCF Gen 2), each as its own workspace.

### Stack

- **Hono** over Express/Fastify for serverless + TS fit.
- **ArkType** via `@hono/arktype-validator` (not Zod).
- **@neon/server-kit**: shared Pino logger, Hono request logging + JSON `onError`, CORS helpers, Resend bootstrap + `renderNeonEmailHtml`, `serveDevApp`; no business logic.
- **@google-cloud/functions-framework** entrypoint; Hono bridge via `getRequestListener` (`@hono/node-server`).
- **Idempotency:** see [Idempotency (webhooks and event-driven work)](#idempotency-webhooks-and-event-driven-work); Stripe webhooks use `stripe_events_processed` + shared `fulfillPaidOrderInTx`.

### Deploying (tsup + gcloud)

- Never deploy `functions/<slug>/` directly (`workspace:*` deps are not published).
- Local dev: `tsc --noEmit` + `tsx watch src/dev.ts`.
- Production:

```bash
pnpm deploy:gcp stripe-api
pnpm deploy:gcp events-api # run pnpm db:events-api:migrate first
pnpm deploy:gcp --all
```

- `node scripts/gcp.mjs bundle <slug>` builds workspace deps, runs tsup (`functions/<slug>/tsup.config.ts` -> `deploy/<slug>/dist/index.js`), installs externals, then deploys with `gcloud functions deploy` + `functions/<slug>/env.yaml`.
- Shared bundle helper: `functions/shared/gcp-bundle.mjs`.
- Register new functions in `scripts/gcp.mjs` `FN` map and add a 3-line `tsup.config.ts`.
- Set `NODE_ENV: "production"` in `env.yaml` (`env.yaml.example`).

### `functions/events-api/` structure

`functions/events-api/` includes `drizzle/`, `src/{db,config,helpers,routes(shared+admin),services(base+*.service.ts),auth,schemas.ts,index.ts}`, plus `drizzle.config.ts`, `package.json`, `.env.example`.

- **Config (`src/config/`)**: static tunables only; no import side effects/clients/DB. Modules include registration, Stripe PI defaults, e2e, sms, contact/profile regex, email templates; import via `../config/<module>`.
- **Routes (`src/routes/`)**: HTTP + orchestration (`runTransaction`, table services, `routes/shared/format-order-tiers.ts`, `routes/admin/providers/*`); never import `drizzle-orm`, `getDb`, `db/schema`; use `services/db.ts` (`isDatabaseConfigured`) and service-exported table refs; map failures with `jsonReasonFailure()` in `routes/shared/respond.ts`.
- **Services (`src/services/`)**: one-table `*.service.ts` exporting `*ResourceMeta` + `tableServiceToBridge`-ready singleton extending `@neon/resource-api` `TableService`; rare `*.view.service.ts` only after `db/views.ts` gate; `services/transaction.ts` is canonical `runTransaction` + `EntityTx` and only allowed non-table/view `getDb().transaction` location (plus `services/db.ts`); forbidden: `services/compose/`, `*-flow.service.ts`, multi-table Drizzle in table services; service-to-service calls only for admin list where helpers; custom admin list logic via `parseListQuery` / `applyListFilters` / `listExecution: "custom"` on the service — never separate `*-list.ts` providers for CRUD tables.
- **Helpers (`src/helpers/`)**: stateless/outbound IO (contact, OTP, Stripe SDK, email, SMS), never HTTP/Hono/Drizzle; order-tier formatting only in `order-tier-labels.ts`; line loading in `routes/shared/format-order-tiers.ts` + table services.

#### Auth middleware (`src/auth/`)

**Load + assert pattern** — typed Hono middleware via `authFactory` (`createFactory<AppEnv>`):

- **Loaders** (`middleware/loaders.ts`) — run resolver once, `c.set` if valid, **always** `next()` (never 401): `loadParticipantSession`, `loadEventApiKey`, `loadAdminSession`.
- **Asserts** (`middleware/assert.ts`) — read `c.var.*` only (never re-resolve), **401** if missing: `requireAuth(key, { predicate?, error? })`, `requireParticipantPerson`, `requireAdminSession`.
- **Resolvers** (`resolvers/*`) — pure DB/Better Auth/Stripe lookups; routes must not call them directly except via loaders / `bearerAuth verifyToken`.
- **Variables** (`env.ts` `AppEnv`): `participantSession`, `eventApiKey`, `adminSession`, `stripeEvent`.

**When to use what:**

| Need | Tool |
|------|------|
| Optional identity enrichment (public `/events*`) | Loaders on route shell only |
| Required session / admin | `createHandlers(requireAuth(...), validator?, handler)` |
| Participant OR API key (future protected routes) | Loaders on shell + `some(requireAuth(...), requireAuth(...))` on asserts |
| Mandatory Bearer (check-in, admissions) | `eventApiKeyBearerAuth` (`bearerAuth` + DB-backed API key) |
| Stripe webhook | `verifyStripeWebhook` (verify + set `stripeEvent`) |

Mount loaders on **route shells** in `routes/index.ts`; participant cookies via `hono/cookie` (`auth/cookies/participant.ts`). Better Auth stays on admin shell only (`loadAdminSession` + `requireAdminSession`); CDN mount unchanged (`auth/public-url.ts`). Entitlement (`invite-only-entitlement.ts`) is authorization, separate from auth loaders/asserts.

**Event API keys** (`api_keys` table, `api-keys.service.ts`):

- **`eventId` null** = global key (read/admissions/check-in for any event); **non-null** = scoped to one event.
- Grant check: `apiKeyGrantsEvent(key, eventId)` — routes return **404** (not 403) on event mismatch for admissions/slug reads.
- Token format: `neon_` + CSPRNG hex; store **SHA-256 hash only**; show raw token once on admin create (`POST /admin/api-keys` or `POST /admin/events/:id/api-keys`); soft revoke via `POST /admin/api-keys/:id/revoke`.
- Optional Bearer on public `/events*` via `loadEventApiKey`; mandatory on `GET /events/:slug/admissions` and `POST /check-in` via `eventApiKeyBearerAuth`.
- Check-in sets `checkedInBy` to `api-key:{label}`; scoped keys pass `restrictToEventId`, global keys pass `null`.

Run auth unit tests: `pnpm --filter @neon/events-api test`.

#### Drizzle migrations (events-api)

- Never hand-edit `drizzle/*.sql`.
- After schema changes in `src/db/schema.ts`, run `drizzle-kit generate` so SQL + `drizzle/meta/*_snapshot.json` stay journal-consistent.
- Commands: root `pnpm db:events-api:generate` (uses `functions/events-api/.env.local` `DATABASE_URL`) or function dir `pnpm db:generate`.
- Commit generated SQL and all generated `drizzle/meta/` updates.
- Apply: `pnpm db:events-api:migrate:local` (local) or `DATABASE_URL=... pnpm db:events-api:migrate` (CI).
- Only if generator cannot express change: `drizzle-kit generate --custom`, then add minimal SQL manually.

#### Early dev default

- Treat events DB as disposable.
- Migrations need not be backward-compatible.
- Assume clean reset after schema changes (drop/recreate Neon branch, `pnpm db:events-api:push:local`, or rerun from `0000` on empty DB).
- Do not add expand-contract/data backfills/nullable transitions solely to preserve existing rows.
- Prefer direct `schema.ts` edits + generated forward migration, or squash baseline when journal gets noisy.
- Re-seed after reset: `pnpm db:events-api:seed:local`.

#### Events terminology (never say "roster")

- **Event invite**: row in `event_invitees` / `eventInvitees`.
- **First-degree event invite**: `event_invitees.inviter_id IS NULL` (admin/host; can mint guest links in `invite_links`).
- **Guest/second-degree event invite**: inviter references host invite.
- **Guest invite link**: share URL token in `invite_links` (`?invite=`).
- Use naming like: `findEventInviteeByContact`, `syncEventInviteesToPerson`, `eventInviteeId` on `ParticipantSessionContext`, `ensureEventInviteeFromGuestCheckoutInTx`.

### `functions/stripe-api/` structure

```
functions/stripe-api/
├── src/
│   ├── index.ts # Hono app/routes/export
│   ├── schemas.ts # ArkType schemas
│   ├── stripe.ts # Stripe singleton client
│   └── dev.ts # local dev server
├── package.json # @neon/stripe-api (ESM)
├── tsconfig.json # strict, ES2022, Node16 modules
└── .env.example
```

### Function patterns

- Relative TS imports must be extensionless (`"./routes/checkout"`, never `"./checkout.js"`). Workspace uses `moduleResolution: "bundler"`; production bundles with tsup. Package imports stay bare (`@neon/server-kit`).
- Define ArkType schemas in `schemas.ts`; validate with `arktypeValidator("json", schema)`.
- Read validated payloads via `c.req.valid("json")`.
- Secrets (`STRIPE_SECRET_KEY`) come from Secret Manager in prod, `.env.local` in dev.
- CORS via `@neon/server-kit` `createCorsFromEnv("simple" | "credentials")`, using `ALLOWED_ORIGIN`/`PUBLIC_SITE_URL`/`EVENTS_ALLOWED_ORIGIN` from each function `.env.example`.
- `pnpm dev` runs `turbo dev`: builds `@neon/server-kit` first (`dependsOn: ["^build"]`), then Next.js, admin (5173), and `tsx watch` for each function in parallel.

## Admin Portal (`apps/admin` + `/admin` API)

### Stack overview (enforced pipeline)

Admin table behavior has **one source of truth per table**. Do not define parallel `fields.list` / introspect config in resources, providers, or the SPA.

**URLs unchanged:** generated CRUD at `/admin/{resource}`; control actions nested (e.g. `POST /admin/orders/:id/refund`); event-scoped ops at `/admin/events/:eventId/invitees/*`; auth at `/admin/auth/*`.

```
*ResourceMeta (export from services/*.service.ts)
  → TableService (extends @neon/resource-api; constructor meta + list/read logic)
  → tableServiceToBridge(svc)
  → defineResource({ meta, service, table, opts })   // routes/admin/resources/
  → composeResourceRouter({ resource, control?, mapCtx })  // routes/admin/router.ts
  → SPA: createAdminListClient + createAdminListService (registry)
```

**Code split:** `routes/admin/resources/` (generated CRUD only) · `routes/admin/control/` (nested actions) · `routes/admin/providers/` (event-scoped invitees, export, upsert).

**Frontend:** `@neon/admin` (Vite + React Router + TanStack Query + dark Shadcn UI), no SSR; local proxy `/api` + `/admin` → `events-api:8082`.

### Admin UI (MUST)

- **Allowed UI:** Shadcn components from `@/components/ui/*` only.
- **Radix (`@radix-ui/*`):** implementation detail confined to `apps/admin/src/components/ui/**`; never import in pages, hooks, or feature components. ESLint enforces this.
- **New primitives:** add via Shadcn CLI (`apps/admin/components.json`); output lands in `components/ui/`.
- **No other UI libs** in admin (no HeroUI, MUI, etc. — web uses HeroUI; admin uses Shadcn).
- Prefer `Button`, `Input`, `Dialog`, etc. over raw HTML form controls.

**Layers:** `lib/admin-api.ts` (HTTP + row types), `lib/admin-list-services/` (paginated list pages), `hooks/use-admin-api/` (detail/mutations only — not duplicate list factories for list pages).

**Auth:** Better Auth at `/admin/auth/*` (not `/api/auth`; CDN must route `/neo-events-api/admin/*`), Google OAuth only, `databaseHooks` + session guard enforce `@neonclub.ch`; `AdminSession` from `auth/resolvers/admin-session.ts`; optional `adminSession` on `ServiceContext` for control handlers; env: `EVENTS_API_PUBLIC_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_ORIGIN`.

**Router:** `functions/events-api/src/routes/admin/router.ts`, mounted at `/admin` via `createAppRouter()` admin shell (`loadAdminSession` + `requireAdminSession` per route; never browser `ADMIN_API_KEY`).

---

### Service layer — shared kernel (MUST)

`@neon/resource-api` is an **HTTP adapter only**. Domain services in `functions/events-api/src/services/` remain the **only DB/table access layer** for **all** routes — checkout, webhooks, registrations, public `/events`, admin control, and admin generated HTTP.

| Layer | Location | Consumers |
|-------|----------|-----------|
| `TableService` + list pipeline | `@neon/resource-api` | Extended by domain services (`services/base/table-service.ts` injects `getDb`) |
| Domain service singleton | `events-api/src/services/*.service.ts` | **All** routes |
| `*ResourceMeta` | Same service file | Admin HTTP list/read projection only |
| `tableServiceToBridge`, `createResourceRouter`, `composeResourceRouter` | `@neon/resource-api` | **`routes/admin/**` only** |
| Route orchestration | `routes/checkout/`, `routes/webhooks/`, `routes/admin/control/`, … | Multi-step flows, Stripe, guards, `runTransaction` |

**MUST:** domain services stay in `events-api`; bridge/router imports only from `routes/admin/**`; `ResourceMeta` is admin projection only; multi-table flows stay in routes; package has no domain logic.

**FORBIDDEN:** business logic reachable only via admin HTTP; routes importing Drizzle/schema directly; participant routes importing resource HTTP router modules; duplicating table queries when a service method exists.

**Call-order:** checkout → `ordersService.createPendingOrderInTx`; admin list → bridge → `ordersService.list`; admin control → `routes/admin/control/orders.ts`; public events → `eventsService.listPublishedPublicCatalogRows`.

---

### Backend — meta single source of truth (MUST)

1. **One `introspectTable(...)` per table** in `functions/events-api/src/services/<table>.service.ts`, exported as `*ResourceMeta` (e.g. `ordersResourceMeta`, `eventInviteesResourceMeta`).
2. **TableService constructor** MUST use that meta: `super({ table, meta: ordersResourceMeta, ... })`.
3. **Admin resources** (`routes/admin/resources/*.ts`) MUST:
   - `import { *ResourceMeta, *Service, *Table } from "../../../services/..."`
   - pass `meta: *ResourceMeta` and `service: tableServiceToBridge(*Service)`
   - keep only resource-specific config in `opts`: `operations`, `exclude` overrides, `schemas`, `hooks`, `parent`
   - **NEVER** put control actions in resources — use `routes/admin/control/`
4. **NEVER** duplicate `opts.fields.list` / `opts.fields.read` in resources — list/read projections live only in service meta.
5. **NEVER** call `introspectTable` in resources, list providers, or export handlers for tables that already have `*ResourceMeta` on the service.

`createResourceRouter` resolves schemas via `def.meta` or `resolveResourceMeta(def)` — not a second introspect from orphaned `opts.fields`.

---

### Backend — TableService bridge (MUST for all admin CRUD tables)

All standard admin resources MUST wire HTTP list/read/mutations through the bridge:

```typescript
// routes/admin/resources/orders.ts — generated CRUD only
export const orders = defineResource({
  table: ordersTable,
  meta: ordersResourceMeta,
  service: tableServiceToBridge(ordersService),
  opts: { operations: ["list", "read"] },
});
```

```typescript
// routes/admin/router.ts
composeResourceRouter({ resource: orders, control: createOrdersControlRouter(), mapCtx })
```

- **Bridge:** `@neon/resource-api` `tableServiceToBridge(svc)` maps `list`, `count`, `get` → `getForAdmin`, bulk mutations, optional `parseListQuery`, `filterMeta`.
- **Read projection:** `TableService.getForAdmin()` MUST return rows projected with `meta.project.read`.
- **Generated routes:** `createResourceRouter` requires `service` bridge; mutations use bridge + `buildArkTypeSchemas(meta, ...)`.
- **FORBIDDEN:** standalone `list:` / `detail:` on resources for tables with `TableService`; `crudProvider` / `CrudService` (removed).

**Wired tables (all use bridge today):** orders, events, people, event-invitees, event-tiers, admissions, invite-links, order-tiers, invite-redemptions, promotion-codes.

---

### Backend — conditional delete (PREFER generated CRUD + `beforeDelete`)

When admin delete is **one row on one table** with preconditions (e.g. unused promotion code, deletable order status), use the generated bridge — **not** a custom `DELETE` on `routes/admin/control/`.

**PREFER:**

1. Enable `"delete"` in `routes/admin/resources/*.ts` `opts.operations`.
2. Implement guards on the domain service: `protected override async beforeDelete(id, ctx?)` on `TableService`.
3. Throw `@neon/resource-api` errors (`ConflictError` → 409, `BadRequestError` → 400, `NotFoundError` → 404). Admin `createAdminRouter` `onError` maps `ResourceApiError` to `{ error }` + status.
4. Admin SPA: `DELETE /admin/{resource}/:id` (204 on success).

```typescript
// services/promotion-codes.service.ts
protected override async beforeDelete(id: string, _ctx?: ServiceContext): Promise<void> {
  const used = await ordersService.countPendingOrPaidForPromotionCode(id);
  if (used > 0) {
    throw new ConflictError("Cannot delete a promotion code that has been used on an order.");
  }
}
```

```typescript
// routes/admin/resources/promotion-codes.ts
opts: { operations: ["list", "read", "delete"] },
```

**Use control `DELETE` only when** the HTTP shape cannot be generated CRUD (multi-step orchestration, Stripe/refund, event-nested surface where the whole feature is control-only and delete is not on the flat resource), or the operation is not a single-table row delete.

**FORBIDDEN:** duplicating `beforeDelete` logic in a control handler when the table already has a bridge resource.

---

### Backend — custom list logic (MUST live on TableService)

Non-trivial list behavior belongs in the service, not `routes/admin/providers/*-list.ts`.

| Concern | Where | Pattern |
|--------|--------|---------|
| Extra query params (e.g. `orderStatus`) | `parseListQuery` override | Strip param, stash on query, delegate to `super.parseListQuery` |
| Filter SQL | `applyListFilters` override | e.g. invitee order-status `WHERE` |
| Shared list + export scope | `resolveAdminListScopeFromRaw(raw, options?)` | Export/providers call service method, not duplicate scope helpers |
| Enriched list rows | `listExecution(): "custom"` + `executeCustomList` | Separate `*ListRow` / `*ListItem` types; `runAdminListFromScope` + typed `project*ListRow()`; merge enrichment with explicit DTO mapping |

**Event invitees:** `ORDER_STATUS_FILTER_KEY`, `resolveAdminListScopeFromRaw` on `EventInviteesService` — export uses `eventInviteesService.resolveAdminListScopeFromRaw` (not deleted `invitees-list-scope.ts`).

**Event tiers:** custom list + `enrichTiersWithCapacityStats` in `EventTiersService`; resource has no `list:` override.

**Providers** under `routes/admin/providers/` are only for: nested route trees, CSV/export, upsert/verify actions, invite-link side effects — **not** paginated CRUD list implementations.

---

### Backend — `@neon/resource-api` (allowed vs removed)

**Use:** `parseListQuery`, `resolveAdminListScope`, `runAdminListFromScope`, `listMetaFromScope`, `buildFilterConditions`, filter suffix operators (`_in`, `_gte`, …), `bulkProvider`, `actionProvider`, `detailProvider`, `listProvider` (when no service), `introspectTable`, `buildArkTypeSchemas`, `TableService`, `tableServiceToBridge`, `defineResource`, `createResourceRouter`, `composeResourceRouter`.

**List pipeline:** `runAdminListFromScope` after `resolveAdminListScope` — do not reintroduce duplicate sort/filter parsing.

**Removed — NEVER reintroduce:** `registerAdminCrud`, `registerAdminRoute`, `customListMeta` (`joined-list.ts`), `useAdminListPagination` (admin SPA), `CrudService`, `crudProvider`, `@neon/admin-crud`.

**Response shape:** `limit`/`skip` query params; list `meta` is `{ total, limit, skip }`. Admin SPA uses UI `page`/`pageSize` and converts to `limit`/`skip` at the HTTP boundary only.

**Drizzle boundary** (`functions/events-api/.eslintrc.json`): `routes/` and `helpers/` cannot import Drizzle/`db/schema`; multi-step writes = route `runTransaction` + service `*InTx`; non-admin routes cannot import `@neon/resource-api` router/bridge modules or `routes/admin/**`.

**Other backend rules (unchanged):** Refund flow `POST /admin/orders/:id/refund` → `202 { pending: true }`; webhook updates DB. Call order: table service → route orchestration → helpers. Never `new EventsService()` at call sites.

**Event invitees CSV export:** `GET /admin/events/:eventId/invitees/export` uses `eventInviteesService.resolveAdminListScopeFromRaw` (same `orderStatus`/sort as list); capped by `MAX_INVITEE_EXPORT_ROWS`; batch `peopleService.list` / `ordersService.list`; `loginLink` via `helpers/public-login-url.ts`.

---

### Admin SPA — HTTP and list layer (MUST)

**List HTTP:** `createAdminListClient<TRow>(path)` in `lib/admin-list-services/create-admin-list-client.ts` — one client per `/admin/{resource}` list endpoint in `admin-api.ts`.

**Row types** in `admin-api.ts` MUST include a comment tying each to backend meta, e.g. `/** Mirrors ordersResourceMeta.project.list. */` — field names MUST match service list projection (no drift).

**Paginated list pages** MUST use `createAdminListService` from `lib/admin-list-services/registry.ts`:

```typescript
export const ordersListService = createAdminListService<OrderRow>({
  defaultSort: { field: "createdAt", direction: "desc" },
  keys: adminKeys.orders,
  listFn: listOrders,
});
```

- **NEVER** add per-table `orders.ts` / `events.ts` list-service files — extend `registry.ts` (~10 lines per resource).
- **NEVER** add `adminApi.{resource}.list` query factories in `hooks/use-admin-api/api.ts` for resources that have a list service — list pages use `*ListService.listQuery()` + `useAdminDataTable` / equivalent.
- **NEVER** add one-off batch-by-ids queries (e.g. `eventsByIds`) when `useForeignKey` can batch via existing list filters.

**Detail / mutations:** `hooks/use-admin-api/api.ts` — `adminApi.person.detail`, `adminApi.order.refund`, etc. Related 0–1 row fetches MUST use `relatedListFirst` / `relatedListTotal` from `lib/admin-related-list.ts` with `relatedListParams({ ...filters })`.

---

### Admin SPA — foreign keys (MUST)

When a list or detail table shows related entities (event title, person name, order status):

**FORBIDDEN:** N+1 `GET /:id` per row; FK-specific `adminApi` factories; manual title joins via separate `eventsByIds` queries; duplicated spinner/link markup in pages.

**MUST:**

1. **Primary list** — `*ListService` or detail query; `page`/`pageSize` → `limit`/`skip` at HTTP boundary only.
2. **Batch FK** — `useForeignKey({ rows, load: [eventFkService, personFkService, ...], scope? })`:
   - `load` is `AdminFkServiceDefinition[]` from `lib/admin-fk-services` — **not** string literals like `"event"`.
   - Dedupe + sort IDs (`canonicalizeIds` / `toIdInParam`); one batched list per FK service per page.
   - Query keys: `adminKeys.{service}.list(canonicalParams)` — not separate `byIds` keys.
3. **Render** — `adminFkColumn(...)` in `AdminDataTable` columns, or `<AdminFkCell fk={fk} fkService={eventFkService} foreignId={...} foreignDisplayField="title" />` in hand-rolled tables.
4. **Detail related tables** — reuse `useForeignKey` + `AdminFkCell` (see `person-detail-related-tables.tsx`); do not hand-roll event title lookups.

**Examples:** Orders list: `load: [eventFkService, personFkService]`. Event invitees: `load: [personFkService, orderFkService]`, `scope: { eventId }`.

**Backend:** FK batching uses `@neon/resource-api` list filters on service `filterable` columns (`id_in`, `eventId`, `personId_in`, …) — add filterable fields in meta/service, not one-off list endpoints.

**Mutations:** Invalidate `adminKeys.{service}.all` (or list prefix) when related rows change.

---

### Admin SPA — tables and columns (MUST)

- **Server-paginated lists:** `AdminDataTable` + column defs in `components/admin-data-table/columns/` using `adminFkColumn`, `adminDateColumn`, etc.
- **Client-sorted detail subtables** (small in-memory lists): may use `Table` + `useClientTableSort` + `useForeignKey` — still MUST use `AdminFkCell` / `adminFkColumn`, not manual FK joins.
- **NEVER** duplicate list pagination hooks — use list services + `useAdminDataTable`.


## Performance Optimization

- Use `next/image` with explicit `width`/`height`; set `priority` for LCP images.
- Use `next/font` self-hosting (e.g. `Space_Grotesk`) for zero CLS font loading.
- Use `loading.tsx` + `Suspense` for streaming/progressive rendering.
- Use `dynamic(() => import("..."), { ssr: false })` for client-only modules (charts/maps, etc.).

## ESLint

Shared package: [`@neon/eslint-config`](packages/eslint-config/) with exports:

- `@neon/eslint-config/base`: TS baseline (`@typescript-eslint`).
- `@neon/eslint-config/node`: `functions/*`, `packages/*` (via `eslint -c ../../.eslintrc.node.json`).
- `@neon/eslint-config/react-rules`: shared React rules for `apps/web` + `apps/admin`.

Apps should add `"@neon/eslint-config": "workspace:*"` plus required React ESLint plugins in app `devDependencies`, and declare plugins locally. Package provides only `base`, `node`, `react-rules`.

## Before Completing a Task

- Run `pnpm build` (all workspaces).
- Run `pnpm lint` (all workspaces).
- Check build output for page-size/static-optimization regressions.
- Verify `generateMetadata` outputs correct titles/descriptions/Open Graph tags.