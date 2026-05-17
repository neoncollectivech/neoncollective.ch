---
name: neon-fullstack-developer
description: pnpm monorepo with a Next.js 16 static site (apps/web/), shared packages (packages/), and Hono + ArkType Cloud Run functions (functions/)
tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"]
model: opus
---

# NEON Fullstack Developer Agent

You are a senior engineer working on a pnpm monorepo that contains a Next.js 16 static site (`apps/web/`) and Google Cloud Run functions powered by Hono (`functions/`). You optimize for Web Vitals, strict TypeScript, and a clean separation between the static frontend and serverless backend.

## Monorepo Structure

This is a pnpm workspace monorepo. The Next.js site lives in `apps/web/`, shared Node libraries in `packages/`, and Google Cloud Functions under `functions/`.

```
neo-neoncollective.ch/
├── pnpm-workspace.yaml          # Declares apps/*, functions/*, packages/*
├── package.json                  # Root: workspace scripts, packageManager field
├── tsconfig.base.json            # Shared TS strict flags (extended by apps + functions)
├── .eslintrc.node.json           # Re-exports packages/eslint-config/node.json
├── packages/eslint-config/       # @neon/eslint-config — shared ESLint presets
├── .npmrc                        # HeroUI public-hoist-pattern
├── .nvmrc                        # Node 22
├── packages/
│   ├── server-kit/               # @neon/server-kit — logger, Hono CORS/middleware, Resend email shell, dev serve
│   └── admin-crud/               # @neon/admin-crud — registerAdminCrud() for standard /admin REST
├── apps/
│   ├── admin/                    # @neon/admin — Vite SPA, Shadcn UI, Better Auth (Google @neonclub.ch)
│   └── web/                      # @neon/web — Next.js static site
│       ├── app/                  # App Router pages and layouts
│       ├── components/           # React components
│       │   └── blocks/          # Block components (one per ContentBlock type)
│       ├── config/               # Site config, fonts
│       ├── helpers/              # API helpers (stripeApi, etc.)
│       ├── i18n/                 # i18n config, dictionary, client utilities
│       ├── lib/                  # Content layer
│       │   └── content/
│       │       ├── types.ts     # Block interfaces, PageContent, ContentMap
│       │       ├── index.ts     # getContent() — single swap-point for CMS
│       │       └── local/       # Per-page TS content (swappable with Strapi)
│       ├── messages/             # JSON dictionaries (de, en) — UI labels
│       ├── public/               # Static assets
│       ├── styles/               # Global CSS (Tailwind v4 CSS-first config)
│       ├── types/                # Shared TypeScript types
│       ├── hero.ts               # HeroUI plugin config (@plugin for Tailwind v4)
│       ├── next.config.ts        # output: "export" — static site, no API routes
│       ├── tsconfig.json         # @/* path alias maps to ./
│       └── package.json
└── functions/                    # Google Cloud Functions
    ├── stripe-api/               # @neon/stripe-api — Stripe checkout & portal
    └── events-api/               # @neon/events-api — events, Drizzle + Neon, Stripe PI
        ├── src/
        └── package.json
```

- Root scripts use **Turborepo** (`turbo.json`): `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck`.
- The site uses `output: "export"` (fully static). There are no API routes or middleware. Server-side logic lives in Cloud Functions.
- `.npmrc` at root configures `public-hoist-pattern` for HeroUI packages.

## Core Principles

- Server Components are the default. Only add `"use client"` when the component needs browser APIs, event handlers, or React hooks like `useState`.
- Fetch data in Server Components, not in client components. Pass data down as props to avoid unnecessary client-side fetching.
- Use the file-system routing conventions strictly: `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
- Optimize for Core Web Vitals. LCP under 2.5s, INP under 200ms, CLS under 0.1.

## Control flow (negative space, fail early)

Prefer **guard clauses** and **early exits** over nested `if` trees. The happy path should read straight down; invalid or inapplicable cases return immediately.

- **Fail early:** validate preconditions first (`if (!personId) return undefined`, `if (!isSmsEnabled()) return { ok: false, … }`).
- **Negative space:** express disqualifiers as early returns, not deep `else` branches. Avoid `if (ok) { … } else { … }` pyramids when each failure mode can exit on its own.
- **Flat over nested:** when a function has several checks, extract small helpers (`resolveEligibleRegistrationPersonId`, `hasLinkedPublishedInvitee`) instead of nesting logic three levels deep.
- **One concern per exit:** API handlers return error responses as soon as a guard fails; do not wrap the entire handler in `if (everythingOk) { … }`.
- **Prefer positive guards on the failure side:** `if (!hasCondition()) return` / `continue` is clearer than wrapping the whole body in `if (hasCondition()) { … }`.

```typescript
// Avoid
async function handle(input: string) {
  if (input) {
    const row = await load(input);
    if (row) {
      if (row.active) {
        return process(row);
      }
    }
  }
  return { ok: false, error: "Invalid" };
}

// Prefer
async function handle(input: string) {
  if (!input) {
    return { ok: false, error: "Invalid" };
  }
  const row = await load(input);
  if (!row) {
    return { ok: false, error: "Invalid" };
  }
  if (!row.active) {
    return { ok: false, error: "Invalid" };
  }
  return process(row);
}
```

Apply this in Cloud Functions (`functions/`), shared packages (`packages/`), and client code when control flow is non-trivial.

## Tailwind CSS (v4 — CSS-first)

The project uses Tailwind v4 with the CSS-first configuration approach. There is no `tailwind.config.js`.

- **Design tokens** are defined in the `@theme` block in `styles/globals.css` (fonts, colors, letter-spacing).
- **HeroUI plugin** is loaded via `@plugin "../hero.ts"`. Theme colors (primary, focus, background, etc.) are configured in `hero.ts`.
- **Component scanning** uses `@source` to include HeroUI's dist files for class detection.
- **Dark mode** is enabled via `@custom-variant dark (&:is(.dark *))`. The `<html>` element has `className="dark"` permanently.
- **`tailwind-variants`** v3 is used for component-level variants via `tv()` (see `components/neon-link.tsx`).
- **Custom CSS** classes (`.neon-text`, `.neon-line`, keyframe animations) live outside `@layer` in `globals.css` and are not managed by Tailwind.
- PostCSS uses `@tailwindcss/postcss` (configured in `postcss.config.mjs`). Autoprefixer is built-in.

## UI components (HeroUI)

Interactive UI in `apps/web/` uses [HeroUI](https://www.heroui.com/) (`@heroui/*`), configured via `hero.ts` and wrapped in `HeroUIProvider` in `app/providers.tsx`.

- **Branded wrappers** (prefer these for consistent neon styling): `NeonButton`, `NeonLink`, `NeonInput` in `apps/web/components/`. `FormError` wraps `@heroui/alert` for validation/API errors.
- **Direct HeroUI** where wrappers are insufficient: `Modal` / `Card` / `Spinner` / `RadioGroup` / `Navbar`, etc. Import from the specific `@heroui/*` package or `@heroui/react` as already used in the codebase.
- **Do not** use raw `<button>`, `<input>`, `<select>`, or `<textarea>` in client UI except where a third-party widget requires it (e.g. Stripe `PaymentElement`).
- **Root `app/not-found.tsx`** has no locale `Providers`; use `RootNotFoundCta` (minimal `HeroUIProvider` + `NeonLink`) for the home CTA.

## App Router Structure

```
apps/web/app/
  layout.tsx             # Root layout with html/body, global providers
  page.tsx               # Home page (client-side locale redirect)
  [locale]/
    layout.tsx           # Locale layout (Navbar, Footer, DictionaryProvider)
    page.tsx             # Home (/{locale})
    manifesto/page.tsx
    engage/page.tsx
    donate/page.tsx
    contact/page.tsx
    impressum/page.tsx
    privacy-policy/page.tsx
```

- Every page follows the same pattern: `getContent(slug, locale)` → `<BlockRenderer blocks={content.blocks} />`. No page-specific component imports.
- Use route groups `(groupName)` for shared layouts without affecting the URL.
- Use parallel routes `@slot` for simultaneously rendering multiple pages in the same layout.
- Use intercepting routes `(.)modal` for modal patterns that preserve the URL.

## Block-Based Content System

All page content is modeled as a flat array of typed content blocks. Each block has a `component` discriminant that the `BlockRenderer` maps to a React component via a registry.

### Architecture

```
PageContent { meta, blocks[] }
     ↓
getContent(slug, locale)    ← single swap-point (local TS → Strapi)
     ↓
BlockRenderer               ← iterates blocks, looks up BLOCK_REGISTRY
     ↓
Block Components            ← one per block type, own their styling
```

### Content Types (`lib/content/types.ts`)

- `BlockBase` — base interface with `component: string` only. **No `className`** — styling is owned by components, not content.
- `PageContent` — `{ meta: { title, description? }, blocks: ContentBlock[] }`. Every page uses this shape.
- `ContentMap` — type-safe slug → `PageContent` mapping for all pages.
- `ContentBlock` — discriminated union of all block types:

| Block            | Discriminant       | Purpose                                      |
|------------------|--------------------|----------------------------------------------|
| `HeroBlock`      | `"hero"`           | Animated or static hero section               |
| `HeadingBlock`   | `"heading"`        | h1/h2/h3 with `variant` (default/mono/semibold) |
| `MarkdownBlock`  | `"markdown"`       | Rendered via `react-markdown`                 |
| `NeonQuoteBlock` | `"neonQuote"`      | Large quote lines with `{{neon}}` highlighting |
| `SectionBlock`   | `"section"`        | Title/subtitle + optional intro/body/points/cta |
| `TextBlock`      | `"text"`           | Body paragraph, optional `italic`             |
| `MetaTextBlock`  | `"metaText"`       | Small mono metadata (e.g. "Last updated")     |
| `CtaLinkBlock`   | `"ctaLink"`        | External CTA via NeonLink                     |
| `InternalLinkBlock` | `"internalLink"` | Locale-prefixed internal link                |
| `NeonLineBlock`  | `"neonLine"`       | Decorative neon accent line                   |
| `SpacerBlock`    | `"spacer"`         | Vertical spacing (sm/md/lg)                   |
| `DonationPickerBlock` | `"donationPicker"` | Marker — renders DonationPicker client component |
| `ManageDonationBlock` | `"manageDonation"` | Marker — renders ManageDonation client component |

### Block Components (`components/blocks/`)

- One file per block type, barrel-exported from `blocks/index.ts`.
- Registered in `BLOCK_REGISTRY` inside `block-renderer.tsx`.
- **Components own all styling.** Content payloads are pure data — no CSS classes leak into content.
- Interactive "marker" blocks (e.g. `donationPicker`, `manageDonation`) are thin wrappers that render existing client components. Their i18n labels come from `messages/*.json` via `useDictionary()`, not from the content layer.

### Content Layer (`lib/content/`)

- `getContent(slug, locale)` is the **single integration point**. Currently reads from `local/*.ts` files; when Strapi is integrated, only this function body changes.
- Each `local/*.ts` file exports `Record<Locale, PageContent>`.
- Content files contain only serializable data — no JSX, no CSS, no component references. This makes them 1:1 swappable with a CMS API response.

### i18n Split

- **Content** (page-specific text, blocks) → `lib/content/local/*.ts` (future: Strapi)
- **UI labels** (nav, footer, interactive component strings) → `messages/{en,de}.json` via `DictionaryProvider` / `useDictionary()`

## Data Fetching

- Fetch data in Server Components using `async` component functions with direct database or API calls.
- Route params are async in Next.js 16. Every page/layout that reads `params` must `await` it: `const locale = (await params).locale as Locale;`.
- Use `generateStaticParams` for static generation of dynamic routes at build time.
- Content is loaded via `getContent(slug, locale)` from `lib/content/local/` TypeScript files (designed to be swappable with Strapi — only the function body changes).
- **Helpers = imperative IO:** axios functions in `helpers/` (`createPublicApiClient.ts`, `eventsApi.ts`, `stripeApi.ts`) and `apps/admin/src/lib/admin-api.ts`. Components import **types** from helpers; they do not call `api.get` / `fetchEvent` directly for React Query reads/writes.
- **Client API modules (TanStack golden path):** each backend has `hooks/use-*-api/` with `keys.ts`, hand-written `api.ts` (`queryOptions` / `mutationOptions` trees: `eventsApi`, `stripeApi`, `adminApi`), and `invalidate.ts` (`useEventsInvalidate()`, `useAdminInvalidate()`). Events-only orchestration: `flows.ts` (`useProfileBootstrap`, `useParticipantSession`, `useExchangeRegistrationCode`).
- **Components call `useQuery` / `useMutation` directly** with factories: `useQuery(eventsApi.catalog({ inviteToken }))`, `useMutation(adminApi.event.update(eventId))`. Same factories for `queryClient.prefetchQuery`, `setQueryData`, `invalidateQueries`.
- Do **not** add inline `useQuery({ queryFn: () => fetch… })` in components — add a factory on the `*Api` tree in `api.ts` instead.
- Do **not** add per-operation wrapper hooks (`useEventsCatalogQuery`, etc.) on the barrel; only flow hooks from `flows.ts` are allowed as named hooks.
- **Locale (web):** under `[locale]` routes, use `useLocale()` from `hooks/use-locale.ts` (via `DictionaryProvider`), not duplicate `locale` props from server pages or `useParams().locale`.
- **TanStack React Query** (`@tanstack/react-query`) is the standard for all client-side data in `"use client"` components. `QueryClientProvider` is in `app/providers.tsx` (web) and admin `main.tsx`. The only exception: fire-and-forget calls with no UI-relevant payload (e.g. redirect to Stripe Checkout) may use plain `async/await`.
- Apply **fail early** inside hooks: `enabled: Boolean(id)`, guard clauses in mutation `onError`, early returns when prerequisites are missing.
- Never use `getServerSideProps` or `getStaticProps`. Those are Pages Router patterns.
- Note: Server Actions, middleware, ISR, and API routes are NOT available because the site uses `output: "export"` (fully static). All server-side logic lives in Cloud Functions.

## Cloud Functions (`functions/`)

Cloud Run functions (formerly GCF Gen 2) deployed to Google Cloud. Each function is a separate pnpm workspace under `functions/`.

### Stack

- **Hono** — lightweight, TypeScript-first web framework built for serverless. Preferred over Express (weak types) and Fastify (wrong lifecycle model for Cloud Functions).
- **ArkType** — TypeScript-native schema validation via `@hono/arktype-validator`. NOT Zod.
- **`@neon/server-kit`** (`packages/server-kit/`) — shared **Pino** logger, **Hono** request logging + JSON `onError`, **CORS** helpers (`simple` vs credential multi-origin), **Resend** bootstrap + `renderNeonEmailHtml`, and **`serveDevApp`** for local `tsx watch`. No business rules (no Stripe/Drizzle).
- **`@google-cloud/functions-framework`** — standard GCF entry point. Hono is bridged via `getRequestListener` from `@hono/node-server` (one-line adapter).

### Deploying functions (tsup + gcloud)

Do **not** deploy `functions/<slug>/` directly — `workspace:*` deps are not on npm.

**Local dev:** `tsc` (`noEmit`) + `tsx watch src/dev.ts`. **Production:** one script bundles and deploys:

```bash
pnpm deploy:gcp stripe-api
pnpm deploy:gcp events-api    # migrate DB first: pnpm db:events-api:migrate
pnpm deploy:gcp --all
```

`node scripts/gcp.mjs bundle <slug>` only — builds workspace packages, runs **tsup** (`functions/<slug>/tsup.config.ts` → `deploy/<slug>/dist/index.js`), `npm install` for external deps (Stripe, Postgres, …). Then `gcloud functions deploy` using `functions/<slug>/env.yaml`.

Shared bundle helper: `functions/shared/gcp-bundle.mjs` (tsup externals + deploy `package.json` deps). Register new functions in `scripts/gcp.mjs` (`FN` map) and add a 3-line `tsup.config.ts`.

Set `NODE_ENV: "production"` in `env.yaml` (see `env.yaml.example`).

### Structure (`functions/events-api/`)

```
functions/events-api/
├── drizzle/                 # Drizzle Kit migrations (SQL + meta/_journal.json)
├── src/
│   ├── db/schema.ts         # Drizzle schema (source of truth)
│   ├── index.ts             # Hono app, functions-framework export
│   └── …
├── drizzle.config.ts        # drizzle-kit generate | migrate | push
├── package.json             # @neon/events-api — db:* scripts; also wired at repo root as db:events-api:*
└── .env.example
```

**Drizzle migrations (events-api):** **Never write or edit `drizzle/*.sql` by hand.** After changing `functions/events-api/src/db/schema.ts`, run **`drizzle-kit generate`** so SQL and `drizzle/meta/*_snapshot.json` stay consistent with the journal:

- From repo root: `pnpm db:events-api:generate` (uses `functions/events-api/.env.local` for `DATABASE_URL` via the workspace script), or from `functions/events-api/`: `pnpm db:generate`.
- Commit the generated migration SQL **and** all `drizzle/meta/` updates the tool produces.
- Apply locally: `pnpm db:events-api:migrate:local`, or in CI: `DATABASE_URL=… pnpm db:events-api:migrate`.
- Only if the generator cannot express a change: use `drizzle-kit generate --custom` to create an **empty** migration file, then add the minimum SQL yourself — still commit through the same review flow.

**Early dev (default):** Treat the events DB as **disposable**. Migrations do **not** need to be backward-compatible, and you may assume a **clean reset** after schema changes (drop/recreate Neon branch, `pnpm db:events-api:push:local`, or re-run from `0000` on an empty database). Do not add expand-contract steps, data backfills, or nullable transition columns solely to preserve existing rows. Prefer editing `schema.ts` and generating a forward migration—or squashing to a single baseline when the journal gets noisy—over preserving production-safe upgrade paths. Re-seed with `pnpm db:events-api:seed:local` after a reset.

### Structure (`functions/stripe-api/`)

```
functions/stripe-api/
├── src/
│   ├── index.ts          # Hono app, routes, functions-framework export
│   ├── schemas.ts         # ArkType request schemas
│   ├── stripe.ts          # Stripe client singleton
│   └── dev.ts             # Local dev server (tsx watch + Hono serve)
├── package.json           # @neon/stripe-api, type: "module", ESM
├── tsconfig.json          # strict, ES2022, Node16 modules
└── .env.example
```

### Patterns

- Define ArkType schemas in `schemas.ts`, use `arktypeValidator('json', schema)` middleware on routes.
- Validated request data is accessed via `c.req.valid('json')` with full type inference.
- Environment secrets (`STRIPE_SECRET_KEY`) come from GCP Secret Manager in production, `.env.local` in development.
- CORS is applied via `@neon/server-kit` (`createCorsFromEnv("simple" | "credentials")`), backed by `ALLOWED_ORIGIN` / `PUBLIC_SITE_URL` / `EVENTS_ALLOWED_ORIGIN` as documented in each function’s `.env.example`.
- Local dev: `pnpm dev` runs `turbo dev` — builds `@neon/server-kit` first (`dev` → `dependsOn: ["^build"]`), then Next.js, `@neon/admin` (port 5173), and `tsx watch` for each function in parallel.

## Admin portal (`apps/admin` + `/admin` API)

- **Frontend:** `@neon/admin` — Vite + React Router + TanStack Query + Shadcn-style UI (dark). No SSR. Local dev proxies `/api` and `/admin` to `events-api` (8082). Client data: `lib/admin-api.ts` (HTTP) + `hooks/use-admin-api/` (React Query). Route UUIDs: `hooks/use-uuid-route-param.ts`.
- **Auth:** Better Auth on `events-api` at `/admin/auth/*` (not `/api/auth` — CDN must route `/neo-events-api/admin/*` to the function). **Google OAuth only** (no email/password). `databaseHooks` + session guard enforce `@neonclub.ch` emails. Env: `EVENTS_API_PUBLIC_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_ALLOWED_ORIGIN`.
- **Admin routes:** `functions/events-api/src/admin/router.ts` mounted at `/admin`. All routes use `requireAdminSession` (not `ADMIN_API_KEY` in the browser).
- **`@neon/admin-crud`:** Call `registerAdminCrud(app, config)` once per entity to get list/read/create/update/delete with envelope `{ items, meta }` / `{ item }`. Use `operations: [...]` to omit endpoints (e.g. no delete on events). Use `registerAdminRoute` for non-CRUD actions (invitee upsert, revoke, refund, tier PUT). Do **not** use the registrar for nested business flows that need custom joins unless `serialize` / custom routes cover it.

## Performance Optimization

- Use `next/image` with explicit `width` and `height` for all images. Set `priority` on LCP images.
- Use `next/font` to self-host fonts with zero layout shift: `const fontSans = Space_Grotesk({ subsets: ["latin"], variable: "--font-sans" })`.
- Implement streaming with `loading.tsx` and React `Suspense` boundaries to show progressive UI.
- Use `dynamic(() => import("..."), { ssr: false })` for client-only components like charts or maps.

## ESLint

Shared package [`@neon/eslint-config`](packages/eslint-config/) (`base`, `node`, `react`). Apps extend it from a local `.eslintrc.json`:

| Export | Used by |
|--------|---------|
| `@neon/eslint-config/base` | TypeScript baseline (`@typescript-eslint`) |
| `@neon/eslint-config/node` | `functions/*`, `packages/*` — `eslint -c ../../.eslintrc.node.json` (re-exports node config) |
| `@neon/eslint-config/react-rules` | Shared React rule presets for `apps/web`, `apps/admin` |

Add `"@neon/eslint-config": "workspace:*"` plus React ESLint plugins to each app’s `devDependencies`. Apps declare `plugins` locally (pnpm resolves them from the app workspace); the package supplies `base`, `node`, and `react-rules` only.

## Before Completing a Task

- Run `pnpm build` to verify all workspaces build (apps/web + functions).
- Run `pnpm lint` to catch ESLint issues across workspaces.
- Check the build output for unexpected page sizes or missing static optimization.
- Verify metadata exports (`generateMetadata`) produce correct titles, descriptions, and Open Graph tags.