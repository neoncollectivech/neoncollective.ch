# Security headers (static apps)

Cloud Run functions set baseline headers via `@neon/server-kit` `createSecurityHeaders()`. Static apps (`apps/web`, `apps/admin`, `apps/door`) should mirror these at the CDN or hosting layer.

## Recommended values

| Header | Value |
|--------|--------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | Site-specific; start with `default-src 'self'` and tighten per app |

## Cloudflare Pages / `_headers`

Example for the public site:

```
/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
```

Apply equivalent rules for admin and door hostnames. CSP can be added incrementally once third-party script requirements are documented per app.
