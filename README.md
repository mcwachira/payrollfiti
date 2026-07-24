# PayrollFiti

Multi-tenant, multi-country payroll SaaS for Africa — run compliant payroll for
Kenya, Nigeria, and South Africa (statutory tax/deductions, payslips, bank
export files, and billing) from one white-labelable platform.

## Monorepo layout

A pnpm + Turborepo monorepo:

```
.
├── apps
│   ├── api                  # NestJS REST API (auth, tenants, employees, payroll, billing, ...)
│   └── web                  # Next.js (App Router) frontend
└── packages
    ├── api                  # Shared DTOs/enums (e.g. Role) used by both api and web
    ├── payroll-rules        # Pure, country-pluggable tax/statutory engine (KE/NG/ZA) — no I/O
    ├── eslint-config         # Shared eslint (+ prettier) config
    ├── jest-config           # Shared jest config
    └── typescript-config     # Shared tsconfig.json bases
```

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for architecture notes, environment
variables, and production deployment guidance.

## Core features

- **Multi-tenant, multi-country payroll runs** — Kenya, Nigeria, and South Africa
  statutory tax/deduction rules, computed by the pure `packages/payroll-rules`
  engine and idempotent per period (re-running the same period is a no-op unless
  underlying salary data changed).
- **Employee management** — companies, employees, contracts, and versioned salary
  structures, all scoped and isolated per tenant.
- **Payslips** — PDF payslip generation and download per payroll entry.
- **Bank export** — CSV bank-file generation per payroll run for salary
  disbursement.
- **Billing** — subscription plans, invoicing, and payment collection via Stripe
  or M-Pesa.
- **White-label branding** — per-tenant app name, logo, and color customization.
- **Role-based access control** — Admin / HR / Employee roles enforced at the API
  layer, plus an employee self-service portal (profile, payslip history, leave).
- **Production hardening** — Helmet security headers, per-IP rate limiting,
  structured JSON logging (`nestjs-pino`), and a real `/health` check
  (`@nestjs/terminus`) covering both Postgres and Redis.

## Local dev quickstart

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres + Redis
docker compose up -d db redis

# 3. Copy env vars and adjust as needed
cp .env.example .env

# 4. Apply database migrations
pnpm --filter api exec prisma migrate deploy

# 5. Seed demo data (dev only — do not run against production)
pnpm --filter api db:seed

# 6. Run api + web together
pnpm dev
```

`apps/api` runs on `http://localhost:3000`, `apps/web` on `http://localhost:3001`.

The seed script (`apps/api/prisma/seed.ts`) creates a demo tenant with:

- **Admin login:** `admin@acme.co.ke` / `Password123!`
- **Employee login:** `jane.wanjiru@acme.co.ke` / `Password123!`

## Testing

```bash
# Unit tests across every app/package
pnpm turbo run test

# API end-to-end tests (needs a real Postgres — see docker compose step above)
pnpm --filter api test:e2e
```

## Deployment

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full guide: required
environment variables, secrets handling, migrations, health checks, logging,
scaling notes, and CI/CD.
