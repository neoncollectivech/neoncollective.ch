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
│   └── admin-crud/ # @neon/admin-crud: crudProvider + list/detail/action providers
├── apps/
│   ├── admin/ # @neon/admin: Vite SPA, Shadcn UI, Better Auth (Google @neonclub.ch)
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
- Components call `useQuery`/`useMutation` with factories (`eventsApi.*`, `adminApi.*`), and reuse those factories for `prefetchQuery`, `setQueryData`, `invalidateQueries`.
- Do not write inline `useQuery({ queryFn: ... })` in components; add factory entries in `api.ts`.
- Do not add per-operation wrapper hooks on barrels (`useEventsCatalogQuery`, etc.); only flow hooks from `flows.ts` are named hooks.
- Locale in `[locale]` client routes: use `useLocale()` from `hooks/use-locale.ts`; do not duplicate locale props or read `useParams().locale`.
- `@tanstack/react-query` is the default client data layer (`QueryClientProvider` in `app/providers.tsx` and admin `main.tsx`).
- Exception: fire-and-forget calls with no UI payload (e.g. Stripe checkout redirect) can use plain `async/await`.
- Apply fail-early in hooks (`enabled: Boolean(id)`, guarded `onError`, early returns for missing prereqs).
- Never use `getServerSideProps`/`getStaticProps` (Pages Router only).
- With static export, do not use Server Actions/middleware/ISR/API routes.

## Cloud Functions (`functions/`)

Cloud Run functions (GCF Gen 2), each as its own workspace.

### Stack

- **Hono** over Express/Fastify for serverless + TS fit.
- **ArkType** via `@hono/arktype-validator` (not Zod).
- **@neon/server-kit**: shared Pino logger, Hono request logging + JSON `onError`, CORS helpers, Resend bootstrap + `renderNeonEmailHtml`, `serveDevApp`; no business logic.
- **@google-cloud/functions-framework** entrypoint; Hono bridge via `getRequestListener` (`@hono/node-server`).

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
- **Services (`src/services/`)**: one-table `*.service.ts`; rare `*.view.service.ts` only after `db/views.ts` gate; `services/transaction.ts` is canonical `runTransaction` + `EntityTx` and only allowed non-table/view `getDb().transaction` location (plus `services/db.ts`, `services/admin/crud-mount.ts`); forbidden: `services/compose/`, `*-flow.service.ts`, multi-table Drizzle in table services; service-to-service calls only for admin list where helpers.
- **Helpers (`src/helpers/`)**: stateless/outbound IO (contact, OTP, Stripe SDK, email, SMS), never HTTP/Hono/Drizzle; order-tier formatting only in `order-tier-labels.ts`; line loading in `routes/shared/format-order-tiers.ts` + table services.

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

- Frontend: `@neon/admin` (Vite + React Router + TanStack Query + dark Shadcn-style UI), no SSR; local proxy `/api` + `/admin` -> `events-api:8082`; HTTP layer `lib/admin-api.ts`, query layer `hooks/use-admin-api/`, UUID helper `hooks/use-uuid-route-param.ts`.
- Auth: Better Auth at `/admin/auth/*` (not `/api/auth`; CDN must route `/neo-events-api/admin/*`), Google OAuth only, `databaseHooks` + session guard enforce `@neonclub.ch`; env: `EVENTS_API_PUBLIC_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_ORIGIN`.
- Admin router: `functions/events-api/src/routes/admin/router.ts`, mounted at `/admin` via `createAppRouter()`, protected by `requireAdminSession` (never browser `ADMIN_API_KEY`).
- `@neon/admin-crud`: `parseListQuery` (`limit`/`skip` query params only; response `meta` is `{ total, limit, skip }`), `buildFilterConditions` suffix operators (`_in`, `_not`, `_gte`, ...), `bulkProvider` (`POST/PATCH /bulk`), column-derived ArkType list schemas; admin list/read/write uses `crudProvider(table, opts)` via `createCrudRouter` (no custom list bridges). Enriched detail payloads use `detail` overrides; side-effect routes (`refund`, `verify`, invite-link actions, tier replace) stay as `actionProvider` extensions. Flat resources: `/admin/events`, `/admin/people`, `/admin/orders`, `/admin/event-invitees` (filter by `eventId`, etc.). Admin SPA uses UI `page`/`pageSize` and converts to `limit`/`skip` at the HTTP boundary.
- Drizzle boundary (`functions/events-api/.eslintrc.json`): `routes/` and `helpers/` cannot import Drizzle/`db/schema`; multi-step writes = route `runTransaction` + service `*InTx`; admin CRUD `getDb` allowed only in `services/admin/crud-mount.ts`.
- Refund flow: `POST /admin/orders/:id/refund` calls Stripe and returns `202 { pending: true }`; DB state updates happen on webhook (`charge.refunded`) in `ordersService.applyRefundFromStripeInTx` (`routes/webhooks.ts`); local dev needs `pnpm stripe:listen`.
- Call order: (1) table service CRUD/`*InTx`; (2) route orchestration for multi-service flows (`checkout`, `webhooks`, `registrations`, `routes/events/read.ts`, admin providers); (3) helpers for stateless IO/cross-table labels (`order-tier-labels.ts`). Keep HTTP mapping in `routes/`; joined admin list/details in `routes/admin/providers/*`; `list`+`count` share `ListQuery` (`limit` 100, `skip` 0, `filters` `{}` defaults); use `detailProvider`/`actionProvider` for nested routes; never `new EventsService()` at call sites.

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