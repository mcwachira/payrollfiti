# Part 12 — Testing, DevOps & Environment Reference

## 12.1 Testing Strategy — Three Layers

**Layer 1: pure-function unit tests (`packages/payroll-rules`)**. No mocking of any kind — every test is a direct input→output assertion against `runPayrollCalculation` or an individual country's helper (Part 3 §3.10). This is the cheapest, fastest, most exhaustive layer, and deliberately where the bulk of statutory-correctness testing lives, because it's the layer with zero infrastructure dependency.

**Layer 2: NestJS service unit tests (`*.service.spec.ts`)**. `PrismaService` and every collaborator are hand-mocked — no test database, no real Postgres. A small typed helper keeps mocks ergonomic under strict TypeScript:

```typescript
// billing/billing.service.spec.ts
// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the
// conditional type behind `.mockResolvedValue()` collapse to `never`. Pin the
// fn's shape to a promise-returning signature up front so mocks stay
// reassignable across test cases.
const asyncMock = (value?: unknown) => jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('BillingService', () => {
  let prisma: any;
  beforeEach(async () => {
    prisma = {
      plan: { findUnique: asyncMock(plan), findMany: asyncMock([plan]) },
      tenant: { findUniqueOrThrow: asyncMock(tenant) },
      subscription: { upsert: asyncMock(subscription), findUnique: asyncMock(subscription) },
      // ...
    };
    // BillingService constructed directly with these mocks via Nest's TestingModule
  });

  it('rejects subscribing to a plan priced for a different country', async () => {
    prisma.plan.findUnique.mockResolvedValueOnce({ ...plan, countryCode: 'NG' });
    prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({ ...tenant, countryCode: 'KE' });
    await expect(service.subscribe('tenant-1', { planCode: 'STARTER' })).rejects.toThrow(BadRequestException);
  });
});
```

This layer is where business-rule branches get tested — currency mismatches, idempotency-key reuse, permission-derivation edge cases, the tenant-scoping extension's `scopeQueryArgs` pure function (Part 4 §4.6) — without paying for a database round-trip per test.

**Layer 3: end-to-end tests (`apps/api/test/*.e2e-spec.ts`)**. A real Postgres instance (via `docker compose` or a CI service container), the full NestJS app bootstrapped with `Test.createTestingModule().compile()`, and real HTTP requests via `supertest` — this is the only layer that exercises the actual `TenantContextInterceptor` + Prisma extension chain end to end, confirming tenant isolation holds under a real request, not just in the unit-tested `scopeQueryArgs` function.

```typescript
// test/employees.e2e-spec.ts (shape)
describe('Employees (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  it('cannot read an employee belonging to another tenant', async () => {
    const { accessToken } = await signupTenantA();
    const otherEmployeeId = await createEmployeeAsTenantB();
    await request(app.getHttpServer())
      .get(`/employees/${otherEmployeeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404); // NotFoundException, not 403 — existence isn't leaked across tenants either
  });
});
```

Returning `404` rather than `403` for a cross-tenant lookup is itself a deliberate choice worth calling out: a `403` would confirm the record exists but is forbidden, leaking existence information across the tenant boundary; `404` reveals nothing.

## 12.2 CI Pipeline

The GitHub Actions workflow has four jobs with a deliberate dependency chain:

```yaml
# .github/workflows/ci.yml
jobs:
  lint-build-test:      # pnpm install, prisma generate, turbo lint/build/test — no real DB
    runs-on: ubuntu-latest
    steps:
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter api exec prisma generate
      - run: pnpm turbo run lint
      - run: pnpm turbo run build
      - run: pnpm turbo run test

  e2e:                   # real Postgres service container, runs migrations, hits real HTTP endpoints
    needs: lint-build-test
    services:
      postgres:
        image: postgres:16-alpine
        options: --health-cmd "pg_isready -U payrollfiti" --health-interval 5s --health-retries 10
    steps:
      - run: pnpm --filter api exec prisma migrate deploy
      - run: pnpm --filter api test:e2e

  docker-build:           # PR-only: proves both images still build, doesn't push anywhere
    needs: lint-build-test
    if: github.event_name == 'pull_request'
    steps:
      - uses: docker/build-push-action@v6
        with: { file: apps/api/Dockerfile, push: false }
      - uses: docker/build-push-action@v6
        with: { file: apps/web/Dockerfile, push: false }

  docker-push:             # main-only: builds AND publishes to GHCR, tagged :latest and :<sha>
    needs: [lint-build-test, e2e]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    permissions: { contents: read, packages: write }
    steps:
      - uses: docker/login-action@v3
        with: { registry: ghcr.io, username: ${{ github.actor }}, password: ${{ secrets.GITHUB_TOKEN }} }
      - uses: docker/build-push-action@v6
        with: { file: apps/api/Dockerfile, push: true, tags: "ghcr.io/${{ github.repository }}-api:latest,...-api:${{ github.sha }}" }
```

`docker-build` and `docker-push` are deliberately split rather than one job with a conditional `push:` flag — a PR branch only needs proof the image *builds*; only a merge to `main`, after both `lint-build-test` and `e2e` have already passed, earns a real publish. The built-in `GITHUB_TOKEN` is sufficient for GHCR — no separate registry credentials need to be provisioned as repo secrets. This publishes images; it does not deploy them anywhere, since no hosting target is wired into this repository.

## 12.3 Dockerfiles — Turborepo Prune + Multi-Stage Build

Both `apps/api/Dockerfile` and `apps/web/Dockerfile` follow the same three-stage shape, using `turbo prune` to strip the monorepo down to just what one app actually needs before installing — so the API's image doesn't carry Next.js's entire dependency tree, and vice versa:

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY . .
RUN pnpm dlx turbo prune api --docker   # strips the monorepo to just `api` + its actual dependencies

FROM base AS installer
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile        # dependency-only layer, cacheable independent of source changes
COPY --from=pruner /app/out/full/ .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN pnpm --filter api exec prisma generate  # placeholder URL is enough — generate never connects to a real DB
RUN pnpm turbo run build --filter=api...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=installer /app .
USER nestjs                                  # never run the production process as root
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

`turbo prune`'s two-phase `out/json` (manifests only) → `out/full` (actual source) copy is what lets Docker's layer cache short-circuit the `pnpm install` layer whenever only source code changed and no dependency changed — a meaningfully faster rebuild loop than copying everything up front.

## 12.4 Environment Variable Reference

Every variable below is read through `configuration.ts`'s typed `AppConfig` — nothing in the codebase reads `process.env` directly outside that one file (Part 4 §4.1's `env.validation.ts` validates the subset that's security-critical).

| Variable | Default (dev) | Required in prod? | Purpose |
|---|---|---|---|
| `APP_NAME` | `PayrollFiti` | No | Fallback branding when a tenant has no `BrandingConfig` |
| `NODE_ENV` | `development` | — | Gates the production-only checks in `env.validation.ts` and `EncryptionService` |
| `PORT` | `3000` | No | API listen port |
| `COUNTRY_DEFAULT` | `KE` | No | Fallback country code where one isn't otherwise resolvable |
| `CORS_ORIGIN` | `http://localhost:3001` | Yes | Allowed frontend origin; also used to build Paystack's checkout `callback_url` |
| `DATABASE_URL` | — | **Yes** | Postgres connection string (Prisma) |
| `REDIS_URL` | `redis://localhost:6379` | Yes | BullMQ queues + cache-manager |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | insecure dev defaults | **Yes** | Signing secrets — boot refuses to start in production with the checked-in default or under 16 chars (Part 4 §4.1) |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | `15m` / `7d` | No | Token lifetimes |
| `THROTTLE_TTL` / `THROTTLE_LIMIT` | `60000` / `100` | No | Rate limit window (ms) and request cap per window |
| `PAYSLIP_STORAGE_DIR` | `./storage/payslips` | No | Local disk path for generated payslip PDFs |
| `DOCUMENT_STORAGE_DIR` | `./storage/documents` | No | Local disk path for uploaded employee documents |
| `ENCRYPTION_KEY` | insecure dev fallback | **Yes** | 64-hex-char AES-256-GCM key for PII field encryption (Part 4 §4.7) — generate via `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PAYSTACK_SECRET_KEY` | unset (stubbed) | For real payments | Paystack API secret key |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` | unset (stubbed) | For real M-Pesa | Daraja API credentials |
| `MPESA_ENV` | `sandbox` | No | `sandbox` or `production` — selects the Daraja base URL |
| `MPESA_CALLBACK_URL` / `MPESA_CALLBACK_TOKEN` | unset | For real M-Pesa | STK push callback URL + shared-secret token (Part 7 §7.4) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | unset / `587` / ... | For real email | Nodemailer transport config |
| `AFRICAS_TALKING_API_KEY` / `_USERNAME` / `_SENDER_ID` | unset (no-op provider) | For real SMS | SMS gateway credentials |
| `SENTRY_DSN` | unset (disabled) | No | Error tracking — inert until set |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3000` | Yes | Frontend's API base URL (build-time + runtime) |
| `NEXT_PUBLIC_APP_NAME` | `PayrollFiti` | No | Frontend fallback branding, mirrors `APP_NAME` |

Every third-party integration — Paystack, M-Pesa, SMTP, Africa's Talking, Sentry — follows the same config-gated-stub pattern: unset in development, the app runs and the feature degrades to a logged no-op or deterministic stub rather than crashing; set in production, the exact same code path makes real calls. This is what makes the entire system runnable end-to-end, feature-complete in terms of code paths exercised, with zero real credentials.

## 12.5 Local Development Quickstart

```bash
git clone <repo> && cd payrollfiti
pnpm install
cp .env.example .env                              # fill in JWT secrets + ENCRYPTION_KEY for anything beyond pure local dev
docker compose up -d db redis                       # infra only — run the apps themselves outside Docker for fast HMR
pnpm --filter api exec prisma migrate deploy
pnpm --filter api exec prisma db seed               # optional: sample tenant/employees/payroll history
pnpm dev                                              # turbo run dev — API on :3000, web on :3001
```

Parts 1–3 established the deterministic, versioned payroll core; Parts 4–9 built the multi-tenant, RBAC-guarded API around it, module by module, each new feature reusing the primitives the ones before it established; Parts 10–11 built a frontend where every page is a thin, typed, React-Query-backed view over that same API; Part 12 ties it all together into a pipeline that lints, tests at three layers, and ships. Parts 13–14 close two gaps that only became visible once the system had real, multi-role users: how an employee actually gets and recovers access, and how the app behaves as an installed, notification-capable PWA rather than just a responsive website. Following all fourteen parts in order reconstructs PayrollFiti from an empty repository to the system described in Part 1 — the same order it was actually built in.
