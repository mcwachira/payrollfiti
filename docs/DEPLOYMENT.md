# Deployment Guide

This document covers deploying PayrollFiti to a production-like environment. For local
development, see the [root README](../README.md).

## Architecture overview

PayrollFiti is a pnpm/Turborepo monorepo with two deployable services and a shared,
pure business-logic package:

- **`apps/api`** — a NestJS service exposing the REST API. Stateless; talks to
  Postgres (system of record) and, optionally, Redis (a performance cache only).
- **`apps/web`** — a Next.js App Router frontend. Stateless; talks to `apps/api`
  over HTTP using `NEXT_PUBLIC_API_URL`.
- **`packages/payroll-rules`** — a pure, country-pluggable tax/statutory-deduction
  engine (Kenya, Nigeria, South Africa) with no I/O of its own; both `apps/api` and
  its test suites import it directly.
- **`packages/api`** — shared DTOs/enums (e.g. `Role`) consumed by both apps so the
  frontend never has to hand-duplicate backend enums.

Both `apps/api` and `apps/web` are built as Docker images (see `apps/api/Dockerfile`
and `apps/web/Dockerfile`) and can be run with `docker-compose.yml` for a
single-host deployment, or deployed independently behind a load balancer for a
scaled-out one.

## Required environment variables

Derived directly from [`.env.example`](../.env.example) at the repo root.

| Variable | Secret? | Default | Notes |
|---|---|---|---|
| `APP_NAME` | config | `PayrollFiti` | White-label app name shown when a tenant has no custom branding. |
| `COUNTRY_DEFAULT` | config | `KE` | Default country code (`KE`, `NG`, `ZA`) for new tenants. |
| `POSTGRES_USER` | secret | `payrollfiti` | Only used by `docker-compose.yml`'s `db` service. |
| `POSTGRES_PASSWORD` | secret | `payrollfiti` | Only used by `docker-compose.yml`'s `db` service. |
| `POSTGRES_DB` | config | `payrollfiti` | Only used by `docker-compose.yml`'s `db` service. |
| `DATABASE_URL` | secret | — | Full Postgres connection string used by Prisma. Required. |
| `REDIS_URL` | config | — | Optional. Omit to run with caching disabled — see "Scaling notes" below. |
| `PORT` | config | `3000` | Port the API listens on. |
| `CORS_ORIGIN` | config | `http://localhost:3001` | Must match the deployed web app's origin. |
| `JWT_ACCESS_SECRET` | secret | — | Signs short-lived access tokens. Rotate carefully (see below). |
| `JWT_ACCESS_EXPIRES_IN` | config | `15m` | Access token lifetime. |
| `JWT_REFRESH_SECRET` | secret | — | Signs longer-lived refresh tokens. |
| `JWT_REFRESH_EXPIRES_IN` | config | `7d` | Refresh token lifetime. |
| `PAYSLIP_STORAGE_DIR` | config | `./storage/payslips` | Filesystem path where generated payslip PDFs are written. On a scaled-out deployment this must be a shared/mounted volume (or swapped for object storage), not local disk per instance. |
| `THROTTLE_TTL` | config | `60000` | Rate-limit window, in ms. |
| `THROTTLE_LIMIT` | config | `100` | Max requests per window, per client. |
| `STRIPE_SECRET_KEY` | secret | — | Required only if the tenant's billing provider is Stripe. |
| `STRIPE_WEBHOOK_SECRET` | secret | — | Required only if Stripe webhooks are wired up. |
| `MPESA_CONSUMER_KEY` | secret | — | Required only if M-Pesa billing is enabled. |
| `MPESA_CONSUMER_SECRET` | secret | — | Required only if M-Pesa billing is enabled. |
| `MPESA_SHORTCODE` | config | — | M-Pesa paybill/till shortcode. |
| `MPESA_PASSKEY` | secret | — | M-Pesa Daraja passkey. |
| `MPESA_ENV` | config | `sandbox` | `sandbox` or `production`. |
| `MPESA_CALLBACK_URL` | config | — | Public URL M-Pesa calls back to. |
| `NEXT_PUBLIC_API_URL` | config | `http://localhost:3000` | Baked into the `apps/web` build; the browser's API base URL. |
| `NEXT_PUBLIC_APP_NAME` | config | `PayrollFiti` | Baked into the `apps/web` build. |

Anything marked **secret** should come from your platform's secret manager (e.g.
Vercel/Fly/Render/AWS Secrets Manager/Doppler), never checked into source control or
baked into an image layer. Config values are safe to set as plain environment
variables in your deployment manifest.

### Secrets handling recommendations

- Generate `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` with real entropy (e.g.
  `openssl rand -hex 32`) per environment — never reuse the `.env.example`
  placeholders past local dev.
- Rotating `JWT_REFRESH_SECRET` invalidates every outstanding refresh token
  (users are forced to log in again); rotating `JWT_ACCESS_SECRET` only affects
  already-issued access tokens until they expire (≤ `JWT_ACCESS_EXPIRES_IN`).
  Plan rotations accordingly.
- `DATABASE_URL` and the Stripe/M-Pesa credentials are the highest-value secrets
  in this system — scope database credentials to the minimum required
  privileges and restrict who can read the deployment's secret store.

## Database migrations

Run migrations as part of your deploy step, before starting new API instances:

```bash
pnpm --filter api exec prisma migrate deploy
```

This applies any pending migrations in `apps/api/prisma/migrations` and is safe to
run repeatedly (a no-op once the schema is up to date).

`apps/api/prisma/seed.ts` (`pnpm --filter api db:seed`) is **dev-only** — it seeds a
demo tenant, admin user, and sample employee/payroll data for local exploration.
**Do not run it against a production database.**

## Health checks

`apps/api` exposes `GET /health` (public, no auth) via `@nestjs/terminus`, checking
both the Postgres connection and the Redis connection (the latter is skipped/healthy
by design when `REDIS_URL` is unset — see below). Point your platform's liveness and
readiness probes at this endpoint. A healthy response looks like:

```json
{
  "status": "ok",
  "info": { "database": { "status": "up" }, "redis": { "status": "up" } },
  "error": {},
  "details": { "database": { "status": "up" }, "redis": { "status": "up" } }
}
```

A non-200 response (Terminus returns 503 on failure) means the API instance
shouldn't receive traffic yet/anymore.

## Logging

`apps/api` uses `nestjs-pino` for structured logging. In production
(`NODE_ENV=production`) it emits newline-delimited JSON at `info` level to stdout,
with `pino-pretty` formatting disabled (pretty-printing is dev-only) and sensitive
fields redacted (`Authorization` headers, password fields, issued tokens). Ship
stdout to whatever log aggregator your platform supports (CloudWatch, Datadog,
Loki, etc.) — no special agent configuration is required beyond capturing stdout.

## Scaling notes

- **`apps/api` and `apps/web` are stateless and horizontally scalable.** Run as
  many instances as you like behind a load balancer; there's no in-process
  session state. The one caveat is `PAYSLIP_STORAGE_DIR` (see the env var table
  above) — use a shared volume or migrate to object storage before scaling the
  API beyond a single instance if you rely on re-reading previously generated
  PDFs from disk.
- **Postgres is a single-primary dependency.** It's the system of record for
  every tenant, so it's the piece to invest HA/backup effort in first. As load
  grows, a connection pooler (PgBouncer) in front of Postgres is the natural
  next step before considering read replicas.
- **Redis is a performance cache only, not a hard dependency.** The app boots
  and runs correctly with `REDIS_URL` unset — `RulesCacheService` simply
  recomputes the relevant country's tax rules on a cache miss instead of
  reading them from Redis, and the `/health` Redis check treats an absent
  `REDIS_URL` as healthy/skipped. Losing Redis costs some latency, not
  correctness, so it does not need the same HA guarantees as Postgres.

## CI/CD

[`​.github/workflows/ci.yml`](../.github/workflows/ci.yml) currently runs on every
push/PR to `main`:

- **`lint-build-test`** — installs deps, generates the Prisma client, lints,
  builds, and runs unit tests across the monorepo (`pnpm turbo run lint|build|test`).
- **`e2e`** — provisions a real Postgres service container, runs
  `prisma migrate deploy`, then `pnpm --filter api test:e2e` against it.
- **`docker-build`** — builds (but doesn't push) both Docker images to catch
  Dockerfile regressions.

A follow-on **deploy** job would extend this pipeline with, roughly:

1. Build and push both images to a registry, tagged with the commit SHA.
2. Run `pnpm --filter api exec prisma migrate deploy` against the target
   environment's database (using that environment's `DATABASE_URL` secret).
3. Roll out the new image(s) to the target environment (e.g. update a Fly/ECS/
   Kubernetes service to the new tag) and wait for `/health` to report `ok` on
   the new instances before shifting traffic / retiring old ones.
4. Gate the whole job on `lint-build-test` and `e2e` passing, and scope it to
   tags/protected branches rather than every push.
