# Part 1 — Introduction & Architecture

## 1.1 What We're Building

PayrollFiti is a multi-tenant SaaS platform that runs payroll and manages HR data for companies across Kenya, Nigeria, and South Africa. Each tenant (a customer organization) has one or more companies, employees, salary structures, and its own subscription and billing history — fully isolated from every other tenant in the same database.

The three things that make this a non-trivial system to build correctly are:

1. **Statutory correctness per country.** Kenya, Nigeria, and South Africa each have their own income tax bands, social security schemes, and levies, and those rules *change over time* (Kenya replaced NHIF with SHIF on 1 Oct 2024, for example). The system has to produce the right numbers today and still be able to reproduce a payslip generated under last year's rules.
2. **Tenant isolation.** One Postgres database serves every customer. A bug that lets tenant A see tenant B's employees is the single worst thing this kind of product can do, so isolation has to be structural, not just "remember to add a `WHERE tenantId = ...`" on every query.
3. **Money has to be exactly right, every time, deterministically.** The same inputs must always produce the same payslip, forever, even after code changes — because a payslip is a legal record.

Everything else in the architecture — the monorepo layout, the module boundaries, the queueing, the testing strategy — exists in service of those three constraints.

## 1.2 Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Monorepo tooling | Turborepo + pnpm workspaces | Shared packages (`payroll-rules`, `pricing`, `api` types) consumed by both frontend and backend with no publish step |
| Backend framework | NestJS (Node/TypeScript) | Modules + DI map cleanly onto domain boundaries (employees, payroll, billing, ...); guards/interceptors give first-class hooks for RBAC and tenant scoping |
| Database | PostgreSQL + Prisma ORM | Prisma's client-extension API lets us enforce tenant scoping *structurally* (Part 4), not just by convention |
| Frontend framework | Next.js 15 (App Router) | Route groups cleanly separate the public marketing site from the authenticated app; server components for static marketing pages, client components + React Query for the data-driven app |
| Data fetching | TanStack React Query | Cache invalidation, optimistic updates, and loading/error state for every API-backed page — no hand-rolled `useEffect` fetching anywhere |
| UI | shadcn/ui + Tailwind CSS | Owned component code (not a black-box npm dependency) styled with CSS variables, which is what makes tenant branding and dark mode both trivial |
| Background jobs | BullMQ (Redis-backed) | Payslip email bulk-dispatch and other async notification work shouldn't block the HTTP request that triggered them |
| Payments | Paystack (cards/bank, primary) + M-Pesa Daraja (STK push) | Both African-market-first providers, integrated behind one `PaymentProvider` interface |
| PDF generation | `@react-pdf/renderer` | Payslips and compliance reports rendered as React components, so branding (logo, color) is just props |
| Offline support | Serwist (service worker) | The employee self-service portal must show a cached payslip with no connection |
| Error tracking | Sentry (DSN-gated, off by default) | Backend exception filter + frontend integration, opt-in via env var so local dev never phones home |

## 1.3 Monorepo Layout

```
payrollpro/
├── apps/
│   ├── web/                  # Next.js 15 App Router frontend
│   │   ├── app/
│   │   │   ├── (marketing)/  # public site: /, /pricing, /reviews, /contact, ...
│   │   │   └── (app)/        # authenticated app: /dashboard, /employees, /payroll, ...
│   │   ├── components/
│   │   ├── lib/               # one *-api.ts file per backend module, React Query hooks
│   │   └── contexts/           # AuthContext, BrandingContext
│   └── api/                  # NestJS backend
│       ├── prisma/
│       │   ├── schema.prisma
│       │   └── migrations/
│       └── src/
│           ├── auth/ employees/ payroll/ payslips/ billing/ leave/ loans/ ...
│           ├── common/         # guards, decorators, tenant context, encryption
│           └── prisma/         # PrismaService + tenant-scoping extension
├── packages/
│   ├── payroll-rules/         # pure calculation engine — zero NestJS/DB dependency
│   ├── pricing/                # per-country plan catalog shared by API and web
│   └── api/                    # shared request/response TypeScript types
├── docker-compose.yml
└── turbo.json
```

The critical architectural decision here is that `packages/payroll-rules` depends on **nothing** — no Prisma, no NestJS, no HTTP. It is pure TypeScript functions operating on plain objects. That is what makes it possible to unit-test statutory tax logic exhaustively without spinning up a database, and to reuse the exact same calculation code in the public, unauthenticated payroll calculator on the marketing site and inside the real backend payroll run.

## 1.4 Core Design Principles

These four principles recur throughout the guide — understanding them up front makes the rest of the implementation read as inevitable rather than arbitrary.

**Pure calculation core.** `runPayrollCalculation(input, ruleSet)` (Part 3) has no side effects: no clock reads, no I/O, no randomness. Given the same input and ruleset it always returns the same result. This is what lets the system hash `(input, ruleVersion)` into a deterministic `inputHash` and use that as an idempotency key — re-submitting the same payroll run request twice never double-processes it.

**Versioned country rules, resolved by effective date.** Every country's rules are a *list* of `CountryRuleSet` objects, each with an `effectiveFrom` date. Resolving "which rules apply" always takes an explicit date (the payroll period, not `Date.now()`), so a payroll run from March 2024 recomputed in 2026 still uses the March 2024 rules. New legislation is added as a new version, never by mutating the old one.

**Structural multi-tenancy.** Tenant scoping is enforced by a Prisma client extension that reads the current tenant out of `AsyncLocalStorage`-backed request context and automatically injects `tenantId` into every query — so a developer who forgets to filter by tenant gets safe behavior by default rather than a silent data leak. Manual `assertCompanyBelongsToTenant`-style checks fill the gap for relations that don't carry `tenantId` directly (Part 4).

**Dual-guard RBAC.** Two independent guards run on every request: `RolesGuard` (coarse: ADMIN/HR/EMPLOYEE) and `PermissionsGuard` (fine-grained: `payroll:run`, `employees:write`, ...). They're both registered globally and both must pass — they are not alternatives to each other (Part 4).

The rest of this guide builds the system in the order it was actually built: schema → pure engine → backend foundations → API modules → integrations → frontend → tests → deployment.
