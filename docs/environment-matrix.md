# Environment Matrix

This document describes where each environment value belongs. It intentionally
contains variable names and ownership, not real credentials or connection
strings.

## Environments

| Area | Local development | Railway staging | Future production-like environment |
| --- | --- | --- | --- |
| API process | `apps/api/.env.local` | Railway `staging → api → Variables` | Separate Railway environment/service variables |
| Web process | `apps/web/.env.local` | Railway `staging → web → Variables` | Separate web service variables |
| PostgreSQL/Supabase | Local Supabase or development project | Dedicated Supabase staging project | Separate production project |
| Redis | Docker Compose on `127.0.0.1:6380` | Railway Redis service reference | Separate managed Redis instance |
| Stripe | Test mode keys | Test mode keys and test webhook endpoint | Live-mode keys and a separate webhook endpoint |
| CI | Safe fixture values only | Not used as a live runtime | Not used as a live runtime |

## API variables

| Variable | Local | Staging/production source | Secret? |
| --- | --- | --- | --- |
| `NODE_ENV` | `development` | Railway service variable | No |
| `PORT` | Local API port | Injected by Railway | No |
| `API_URL` | Local API URL | Generated Railway API URL | No |
| `WEB_URL` | Local web URL | Generated Railway web URL | No |
| `SUPABASE_URL` | Local/development project URL | Supabase staging/production project URL | No |
| `SUPABASE_ANON_KEY` | Local project publishable key | Matching project publishable key | Public-ish |
| `SUPABASE_SERVICE_ROLE_KEY` | Local service key | Matching project secret key | Yes |
| `DATABASE_URL` | Local Postgres connection | Supabase staging/production connection | Yes |
| `REDIS_URL` | `redis://127.0.0.1:6380` | `${{redis.REDIS_URL}}` reference | Yes |
| `STRIPE_SECRET_KEY` | Stripe test secret | Stripe test secret | Yes |
| `STRIPE_WEBHOOK_SECRET` | Local CLI endpoint secret | Dashboard test endpoint secret | Yes |
| `STRIPE_CREDITS_PRICE_ID` | Test price | Test price | No |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Test price | Test price | No |

## Web variables

| Variable | Local | Railway staging source |
| --- | --- | --- |
| `VITE_API_URL` | Local API URL | Generated Railway API URL |
| `VITE_SUPABASE_URL` | Local/development project URL | Supabase staging URL |
| `VITE_SUPABASE_ANON_KEY` | Local publishable key | Staging publishable key |
| `WEB_ALLOWED_HOST` | Usually omitted | Railway web hostname, until canonical `WEB_URL` parsing is used |

## Rules

- Never commit `.env.local`, passwords, private keys, or webhook secrets.
- Keep variable names stable across environments; change only their values.
- Do not use local `localhost` or `127.0.0.1` values in Railway.
- Do not manually copy the Railway Redis password when a service reference is available.
- CI must use safe fixtures and must not depend on live Supabase, Stripe, or Redis.
- Test and live Stripe credentials and webhook endpoints are separate systems.
