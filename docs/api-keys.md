# Event API keys

Bearer tokens (`neon_…`) authenticate the door PWA, POS, and check-in integrations.

## Issuing keys

| Key type | `eventId` | Use for |
|----------|-----------|---------|
| **Event-scoped** | Set to one event | Door tablets at a single event: check-in, POS sales, catalog |
| **Global** | `null` | Initial SumUp reader setup (`/pos/readers*`) only — not on venue tablets |

Create keys in admin: **Event → API keys** (scoped) or **Admin → API keys** (global).

## Operational rules

1. **Never put global keys on shared tablets** — they can pair/delete SumUp readers for the whole merchant account.
2. **Revoke keys after each event** — use admin revoke; monitor `lastUsedAt`.
3. **One key per device** where possible — simplifies rotation if a tablet is lost.
4. **Physical security** — door app stores the API key in `sessionStorage` (cleared when the browser tab closes); use dedicated devices with screen lock.

## What keys can access

Route groups require matching **scopes** on the key (missing scope → `404`):

| Capability | Scope | Routes |
|------------|-------|--------|
| Check-in + offline JWKS | `check_in` | `POST /check-in`, `GET /admission/jwks` |
| POS sales | `pos` | `/pos/catalog`, `/pos/sale`, guest resolve, … |
| SumUp reader setup | `pos_admin` | `GET/POST/DELETE /pos/readers*` (**global keys only**) |
| Admissions list | `admissions_list` | `GET /events/:slug/admissions` (summary only, no credentials) |

**Defaults:** event-scoped keys → `check_in`, `pos`. Global keys → all four scopes (adjust in admin when minting).