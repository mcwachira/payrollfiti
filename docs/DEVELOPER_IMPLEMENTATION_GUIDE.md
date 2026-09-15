# PayrollFiti Developer Implementation Guide — Parts 1–19

> Complete engineering manual for the PayrollFiti Laravel 13 + Next.js monorepo.
> For architecture diagrams, see [SYSTEM_DESIGN.md](architecture/SYSTEM_DESIGN.md).
> For current status, see [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md).

---

## Table of Contents

1. [Foundation & Stack](#1-foundation--stack)
2. [Monorepo & Docker](#2-monorepo--docker)
3. [Database & Tenancy](#3-database--tenancy)
4. [Laravel Architecture](#4-laravel-architecture)
5. [Auth, RBAC & Multi-Tenancy](#5-auth-rbac--multi-tenancy)
6. [Payroll Engine](#6-payroll-engine)
7. [Payroll API](#7-payroll-api)
8. [Compliance & Country Rules](#8-compliance--country-rules)
9. [Billing & Payments](#9-billing--payments)
10. [Queues, Redis & Messaging](#10-queues-redis--messaging)
11. [Notifications](#11-notifications)
12. [HR Features](#12-hr-features)
13. [Employee Onboarding](#13-employee-onboarding)
14. [2FA & Session Management](#14-2fa--session-management)
15. [API Keys & Webhooks (Part 18)](#15-api-keys--webhooks-part-18)
16. [Accounting Integrations (Part 19)](#16-accounting-integrations-part-19)
17. [Testing](#17-testing)
18. [Security](#18-security)
19. [Troubleshooting](#19-troubleshooting)

---

## 1. Foundation & Stack

### Backend
- **Laravel 13** in `apps/api`
- **PostgreSQL 16** — shared-schema multi-tenancy with RLS
- **Redis 7** — cache, sessions, queues, Horizon metadata
- **Laravel Sanctum** — session + token auth
- **Spatie Laravel Permission 8** — RBAC
- **Laravel Horizon 5** — queue monitoring
- **browsershot/dompdf** — PDF generation (payslips)

### Frontend
- **Next.js 16** + **React 19** in `apps/web`
- **TanStack Query** — server state
- **Tailwind CSS** + **shadcn/ui** — styling

### Key files
- `apps/api/bootstrap/app.php` — providers, middleware aliases (`tenant.context`)
- `apps/api/composer.json` — backend dependencies
- `apps/web/package.json` — frontend dependencies
- `docker-compose.yml` — 11-service local stack

---

## 2. Monorepo & Docker

### Structure
```
payrollfiti/
├── apps/
│   ├── api/                 # Laravel backend
│   │   ├── app/
│   │   │   ├── Domain/      # Payroll, Compliance, Payments, Messaging, Notifications, Onboarding, Attendance, Leave, Loans, Documents
│   │   │   ├── Http/        # Controllers, Requests, Resources
│   │   │   ├── Models/      # Eloquent models + Concerns/Scopes
│   │   │   ├── Policies/    # Authorization
│   │   │   ├── Jobs/        # Queue jobs
│   │   │   ├── Listeners/   # Event listeners
│   │   │   ├── Services/    # Application services
│   │   │   ├── Support/     # TenantContext
│   │   │   └── Providers/   # Service providers
│   │   ├── database/
│   │   │   ├── migrations/  # 50+ migrations
│   │   │   └── seeders/
│   │   ├── routes/
│   │   │   ├── api.php      # Versioned API routes
│   │   │   ├── web.php      # Session auth routes
│   │   │   └── console.php  # Scheduled commands
│   │   └── tests/
│   └── web/                 # Next.js frontend
│       └── app/
│           ├── (app)/       # Dashboard pages
│           ├── (auth)/      # Login, signup, forgot-password
│           └── (Marketing)/ # Public pages
├── docs/
├── docker-compose.yml
└── turbo.json / pnpm-workspace.yaml
```

### Why monorepo?
Shared Docker, CI/CD, and cross-app types. Single deploy unit for the API.

---

## 3. Database & Tenancy

### Isolation model
Shared schema with `tenant_id` on every tenant-owned table. Two enforcement layers:

1. **Application**: global `TenantScope` via `BelongsToTenant` trait
2. **Database**: PostgreSQL RLS policies that read `current_setting('app.current_tenant_id')`

### Key tables
- `tenants` — customer organizations
- `companies` — legal entities within a tenant
- `users` — authentication + tenant association
- All domain tables carry `tenant_id` + FK to `tenants`

### TenantContext flow
```
Request
  ↓
SetCurrentTenantContext middleware
  ↓
TenantContext::set($tenantId)
  ↓
PostgreSQL: set_config('app.current_tenant_id', ...)
  ↓
TenantScope + RLS filter every query
```

### Files
- `app/Models/Concerns/BelongsToTenant.php` — global scope + auto-fill on create
- `app/Models/Scopes/TenantScope.php` — WHERE tenant_id = current
- `app/Support/TenantContext.php` — static holder + PostgreSQL set_config
- `app/Http/Middleware/SetCurrentTenantContext.php` — resolves from user or header, clears in `finally`

---

## 4. Laravel Architecture

### Layer rules
| Layer | Responsibility | Examples |
|-------|----------------|----------|
| **Domain** | Business logic, rules | `Domain/Payroll/Engine/*`, `Domain/Compliance/*` |
| **Application** | Use cases, commands | `RunPayrollCommand`, `ProcessPaymentWebhook` |
| **HTTP** | Request/response | Controllers, FormRequests, Resources |
| **Data** | Persistence | Models, Migrations |
| **Authorization** | Access control | Policies, Spatie permissions |

### Domain modules
- `Domain/Payroll` — calculation engine, rules, commands
- `Domain/Compliance` — country generators, report service
- `Domain/Payments` — contracts, events, providers
- `Domain/Messaging` — outbox dispatcher
- `Domain/Notifications` — dispatcher, channels, template renderer
- `Domain/Onboarding` — task service, events
- `Domain/Attendance`, `Domain/Leave`, `Domain/Loans`, `Domain/Documents` — HR modules

### Cross-domain communication
1. Direct method call within a command
2. Domain event → queued listener (Part 13)
3. Scheduled Artisan command (Part 36)

---

## 5. Auth, RBAC & Multi-Tenancy

### Authentication
- **Frontend flow**: Next.js SPA on `localhost:3000` calls Laravel API on `localhost:8000`
- **CSRF handling**: Frontend `apiFetch` calls `GET /api/sanctum/csrf-cookie` before state-changing requests; backend returns `{status, token}`; frontend sends `X-CSRF-TOKEN` header
- **Session-based auth**: Laravel `web` guard with Redis sessions; CSRF enforced via `PreventRequestForgeryCompat`
- **Token-based auth**: Sanctum personal access tokens returned in JSON responses; stored in `localStorage`
- **Hybrid model**: Backend creates session AND returns Sanctum token; frontend uses both
- **2FA via TOTP** (Part 17): challenge stored in session, verified via `/api/account/2fa/login/verify`

### Authorization
- **Gate::before** in `AppServiceProvider` — `platform_admin` bypasses all checks
- **Policies** per model — tenant + permission checks
- **Spatie permissions** — seeded per tenant

### Key files
- `apps/api/routes/web.php` — auth routes prefixed with `/api` (login, signup, logout, me, refresh, 2FA, sessions)
- `apps/api/app/Http/Controllers/AuthController.php` — login, logout, me, password reset, signup, acceptInvite, refresh
- `apps/api/app/Http/Controllers/TwoFactorAuthenticationController.php` — 2FA setup, verify, disable, recovery codes, login verify
- `apps/api/app/Http/Controllers/AccountSessionController.php` — session management
- `apps/web/contexts/AuthContext.tsx` — centralized auth state, login, signup, logout, 2FA
- `apps/web/lib/api-client.ts` — `apiFetch` with CSRF handling, token refresh, error handling
- `apps/web/lib/token-storage.ts` — localStorage token persistence
- `apps/web/shared-types.ts` — `AuthenticatedUserDto`, `AuthTokensDto`, `TwoFactorChallenge`
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL=http://localhost:8000/api`
- `apps/api/config/sanctum.php` — stateful domains: `localhost,localhost:3000,127.0.0.1,127.0.0.1:8000`
- `app/Policies/*` — per-model authorization

### CSRF Architecture
- Backend middleware: `PreventRequestForgeryCompat` extends Laravel's `VerifyCsrfToken`
- Accepts `_token` input, `X-CSRF-TOKEN` header, or `X-XSRF-TOKEN` header
- Frontend `ensureCsrfToken()` fetches `GET /api/sanctum/csrf-cookie` and caches the token
- Token attached to all POST/PUT/PATCH/DELETE requests via `X-CSRF-TOKEN` header
- Session cookie managed by browser via `credentials: 'include'`

### Login Flow
1. `POST /api/login` with `{email, password}`
2. Backend validates, checks 2FA status
3. If 2FA enabled: returns 202 `{requires_2fa: true, challengeToken: "..."}`
4. If no 2FA: logs in via `Auth::guard('web')->login()`, creates `UserSession`, returns `{user, accessToken, refreshToken, tenant_id}`
5. Frontend stores tokens in `localStorage`, sets auth state, redirects by role

### 2FA Login Flow
1. `POST /api/account/2fa/login/verify` with `{challenge_id, code}`
2. Backend validates challenge from session, verifies TOTP/recovery code
3. Logs in user, creates `UserSession`, returns `{user, accessToken, refreshToken, tenant_id}`
4. Frontend stores tokens, redirects by role

### Logout Flow
1. `POST /api/logout` with Bearer token
2. Backend deletes current Sanctum token, invalidates session
3. Frontend clears `localStorage`, redirects to login

### Signup Flow
1. `POST /api/signup` with `{tenantName, countryCode, adminEmail, adminPassword}`
2. Backend generates base slug/subdomain from tenant name (e.g., `test user` → `test-user`)
3. Backend attempts tenant creation inside `DB::transaction()`
4. If unique constraint violation occurs, retries with incremented suffix (`test-user-2`, `test-user-3`, etc.)
5. Maximum 10 retry attempts; returns user-friendly 422 error if exhausted
6. Creates `Company`, `User`, assigns `admin` role
7. Logs in user, creates `UserSession`, returns `{user, accessToken, refreshToken, tenant_id}`
8. Frontend redirects to onboarding

**Tenant Slug/Subdomain Collision Handling:**
- Slug and subdomain must be unique (`tenants_slug_unique`, `tenants_subdomain_unique`)
- Collision-safe retry loop inside database transaction
- Concurrency-safe: handles simultaneous signup requests with same base name
- Never reuses existing tenant — always creates new unique tenant identity
- Transaction ensures atomic tenant/user/company creation

### Session Management
- `GET /api/account/sessions` — lists `UserSession` records
- `DELETE /api/account/sessions/{id}` — revokes specific session
- `DELETE /api/account/sessions/others` — revokes all other sessions
- Sessions tracked via `UserSession` model with IP, user agent, last active

### Tenant-scoped route bindings
All bindings in `AppServiceProvider::boot()` use `withoutTenantScope()` then explicit tenant/user checks in the closure or policy. This prevents cross-tenant existence leaks.

---

## 6. Payroll Engine

### Architecture
```
RunPayrollCommand
  → PayrollInput DTO (deterministic)
  → RuleRegistry.resolve(countryCode, effectiveDate)
  → CountryRuleSet
  → PayrollCalculator.calculate()
  → PayrollResult DTO
  → Persist PayrollRun + PayrollEntries
  → Dispatch PayrollRunCompleted event
```

### Money & determinism
- All monetary values are **strings** (bcmath)
- `app/Domain/Payroll/Engine/Money.php` — `round2`, `sum`, `add`, `sub`, `mul`, `div`, `cmp`
- **Rule: floats are never authoritative for money**

### Idempotency
- `input_hash` (SHA-256 of normalized inputs) on `payroll_runs`
- Duplicate hash → return existing run

### Files
- `app/Domain/Payroll/Engine/Money.php`
- `app/Domain/Payroll/Engine/PayrollCalculator.php`
- `app/Domain/Payroll/Engine/RuleRegistry.php`
- `app/Domain/Payroll/Engine/Rules/{Kenya,Nigeria,SouthAfrica}/*`
- `app/Domain/Payroll/Application/Commands/RunPayrollCommand.php`

---

## 7. Payroll API

### Routes (`routes/api.php`, `auth:sanctum` + `v1` prefix)
| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/payroll/runs` | index |
| GET | `/api/v1/payroll/runs/{run}` | show |
| POST | `/api/v1/payroll/runs` | store |
| POST | `/api/v1/payroll/runs/{run}/approve` | approve |
| POST | `/api/v1/payroll/runs/{run}/finalize` | finalize |

### Files
- `app/Http/Controllers/Api/V1/PayrollRunController.php`
- `app/Http/Requests/Api/V1/RunPayrollRequest.php`
- `app/Http/Resources/PayrollRunResource.php`
- `app/Policies/PayrollRunPolicy.php`

---

## 8. Compliance & Country Rules

### Design
Country-gated, template-driven, consumes persisted payroll entries — never recalculates.

### Generators
- `KenyaComplianceGenerator` → KE-P9
- `NigeriaComplianceGenerator` → NG-PAYE
- `SouthAfricaComplianceGenerator` → ZA-PAYE
- `UgandaComplianceGenerator` → UG-PAYE

### Idempotency
Unique constraint on `(tenant_id, company_id, payroll_run_id, report_code, report_version)`.

### Routes
| Method | Path |
|--------|------|
| GET | `/api/v1/compliance/reports` |
| POST | `/api/v1/compliance/reports` |
| GET | `/api/v1/compliance/reports/{id}` |
| POST | `/api/v1/payroll/runs/{run}/compliance` |

---

## 9. Billing & Payments

### Payment providers
- `PaystackProvider` — SHA-512 HMAC webhooks, kobo minor units
- `MpesaProvider` — Daraja OAuth + STK Push

### State machine
`PaymentTransaction::transitionTo()` enforces:
- `pending → processing → succeeded|failed|expired`
- Terminal states immutable — duplicate delivery is a no-op

### Webhooks
- `POST /api/v1/webhooks/{provider}` — unauthenticated, signature-verified
- `firstOrCreate` on `(provider, provider_event_id)` — replay protection
- `ProcessPaymentWebhook` — queued, tenant-scoped

### Scheduled commands
- `payments:reconcile-pending` — every 15 min
- `billing:process-subscription-renewals` — daily 02:00

### Files
- `app/Domain/Payments/Contracts/PaymentProvider.php`
- `app/Infrastructure/Payments/{PaystackProvider,MpesaProvider,CurlClient}.php`
- `app/Models/{Plan,Subscription,Invoice,UsageRecord,PaymentTransaction,PaymentProviderEvent}.php`
- `app/Jobs/ProcessPaymentWebhook.php`
- `app/Http/Controllers/Api/V1/Billing/*.php`
- `app/Console/Commands/{ReconcilePendingPaymentsCommand,ProcessSubscriptionRenewalsCommand}.php`

---

## 10. Queues, Redis & Messaging

### Stack
- Redis queues with `after_commit => true`
- Horizon 5 supervisors, 10 queues
- `TenantAwareJob` — sets/closes `TenantContext` in `finally`

### Queue topology
| Queue | Purpose |
|-------|---------|
| high | 2FA codes, password resets |
| default | general-purpose |
| payroll | payslip generation |
| notifications | notification writes |
| email | outbound email |
| sms | outbound SMS |
| webhooks | outbound + inbound |
| reports | compliance reports |
| exports | bulk data exports |
| integrations | accounting sync |

### Transactional outbox
`outbox_events` written in the same DB transaction as state changes for payroll completion and payment settlement. `queue:dispatch-outbox` polls every 5s and publishes via `FOR UPDATE SKIP LOCKED`.

### Fan-out
`PayrollRunCompleted` → 4 queued listeners on 4 queues.
`PaymentSettled` → `DispatchOutboundWebhooks`.

### Files
- `config/queue.php`, `config/horizon.php`
- `app/Domain/Messaging/OutboxDispatcher.php`
- `app/Jobs/TenantAwareJob.php`
- `app/Jobs/{GeneratePayslip,DeliverWebhook,ProcessPaymentWebhook,SyncAccountingConnection}.php`
- `app/Listeners/{GeneratePayslips,SendPayrollCompletionNotifications,DispatchOutboundWebhooks,SyncPayrollToAccounting}.php`
- `routes/console.php`

---

## 11. Notifications

### Pipeline
```
Domain event
  → Listener → NotificationDispatcher::notify()
    → idempotency check (dedupe_hash)
    → preference gate (user prefs ∩ defaults)
    → TemplateRenderer (allow-list substitution)
    → Notification + NotificationDelivery rows
  → SendNotificationDelivery job (queue: notifications)
    → Channel (Email/Sms/Push) → Provider
```

### Key files
- `app/Domain/Notifications/NotificationTypes.php`
- `app/Domain/Notifications/{NotificationDispatcher,TemplateRenderer,ChannelRegistry}.php`
- `app/Domain/Notifications/Channels/{EmailChannel,SmsChannel,PushChannel}.php`
- `app/Domain/Notifications/Contracts/{NotificationChannel,SmsProvider,PushProvider}.php`
- `app/Models/{Notification,NotificationTemplate,NotificationPreference,NotificationDelivery,PushSubscription}.php`
- `app/Jobs/SendNotificationDelivery.php`
- `app/Listeners/{SendPayrollCompletionNotifications,NotifyPaymentSucceeded,NotifyPaymentFailed,NotifyComplianceReportReady,NotifyNewLogin}.php`
- `app/Http/Controllers/Api/V1/{NotificationController,NotificationPreferenceController,PushSubscriptionController}.php`

### API (outside v1 prefix, auth:sanctum)
| Method | Path |
|--------|------|
| GET | `/notifications` |
| GET | `/notifications/{id}` |
| POST | `/notifications/{id}/read` |
| POST | `/notifications/read-all` |
| GET | `/notification-preferences` |
| PUT | `/notification-preferences` |
| GET | `/push-subscriptions/vapid-public-key` |
| POST | `/push-subscriptions` |
| DELETE | `/push-subscriptions` |

---

## 12. HR Features

### Leave
- `LeaveType`, `LeaveBalance`, `LeaveRequest` (+ `LeaveApproval`)
- State machine: `pending → approved|rejected`, `approved → cancelled` (grace window)
- Monthly accrual: `leave:accrue-monthly` command, idempotent via `leave_accruals` unique `(employee_id, leave_type_id, period)`

### Loans
- `Loan`, `LoanRepayment`
- Immutable schedule generated at approval
- Payroll integration via `voluntaryDeductions`
- `loans:process-repayments` daily command

### Attendance
- `AttendanceRecord` (present/absent/leave per day)
- Feeds proration for hourly/daily-rate employees

### Documents
- `EmployeeDocument`, `DocumentVersion`
- S3 upload with tenant-prefixed keys
- Short-lived signed URLs

### Files
- `app/Models/{LeaveType,LeaveBalance,LeaveRequest,LeaveApproval,LeaveAccrual,Loan,LoanProduct,LoanRepayment,AttendancePolicy,AttendanceRecord,PublicHoliday,DocumentType,EmployeeDocument,DocumentVersion}.php`
- `app/Domain/{Leave,Loans,Attendance,Documents}/**`
- `app/Http/Controllers/Api/V1/{Leave,Loan,Attendance,Documents}/*.php`
- `app/Policies/{LeaveRequestPolicy,LoanPolicy,AttendancePolicy,EmployeeDocumentPolicy}.php`

---

## 13. Employee Onboarding

### Scope
- `OnboardingTask` — generated from per-company checklist at employee creation
- Employee can view/complete own tasks
- `OnboardingTaskPolicy::view()` checks `$task->employee->user_id === $user->id`

### Known gaps
- `OnboardingTaskService` exists but is bypassed by controller
- `OnboardingTaskCompleted` event registered but never dispatched
- `employee_emergency_contacts` has only a migration

### Files
- `app/Models/OnboardingTask.php`
- `app/Http/Controllers/Api/V1/Onboarding/OnboardingTaskController.php`
- `app/Policies/OnboardingTaskPolicy.php`
- `app/Domain/Onboarding/{Services,Events}/*.php`
- `app/Listeners/Onboarding/HandleOnboardingTaskCompleted.php`
- `database/migrations/2026_09_10_120026_create_onboarding_tasks_table.php`
- `database/migrations/2026_09_10_120025_create_employee_emergency_contacts_table.php`

---

## 14. 2FA & Session Management

### Three-call TOTP flow
1. `POST /account/2fa/setup` — generates secret + QR code (stored PENDING in session)
2. `POST /account/2fa/verify` — validates TOTP code, activates 2FA, generates 10 recovery codes (shown once)
3. `POST /login/2fa/login/verify` — second step of login, validates challenge_id + TOTP/recovery code

### Security properties
- Recovery codes hashed at rest (bcrypt), single-use
- Rate limiting: 5 failed attempts/min per user+IP
- Challenge ID validated with `hash_equals()` against stored session
- Tenant-scoped via `BelongsToTenant`

### Session management
| Method | Path |
|--------|------|
| GET | `/account/sessions` |
| DELETE | `/account/sessions/{id}` |
| DELETE | `/account/sessions/others` |

### Files
- `app/Models/{TwoFactorAuthentication,RecoveryCode,UserSession}.php`
- `app/Services/Auth/TwoFactorAuthenticationService.php` — `generateSecret()`, `verifyCode()`, `generateRecoveryCodes()`, `hashRecoveryCode()`, `checkRecoveryCode()`
- `app/Http/Controllers/TwoFactorAuthenticationController.php`
- `app/Http/Controllers/AccountSessionController.php`
- `database/migrations/2026_09_10_202005_create_auth_support_tables.php`

### Tests
- `tests/Feature/TwoFactorAuthenticationTest.php` — 10 tests covering setup, verify, login flow, recovery codes, disable, session CRUD

---

## 15. Testing

### Commands
```bash
# Full suite
docker compose exec api php artisan test

# Filter
php artisan test --filter=TwoFactorAuthenticationTest
```

### Test files
| File | Tests | Part |
|------|-------|------|
| `AuthSessionTest.php` | 3 | Auth |
| `TwoFactorAuthenticationTest.php` | 10 | Part 17 |
| `OnboardingTaskTest.php` | 5 | Part 16 |
| `NotificationSystemTest.php` | 20 | Part 14 |
| `QueueMessagingTest.php` | 14 | Part 13 |
| `BillingPaymentsTest.php` | 8 | Part 12 |
| `ComplianceReportTest.php` | 6 | Part 11 |
| `PayrollDomainTest.php` | 4 | Part 9 |
| `LeaveRequestTest.php` | 4 | Part 15 |
| `LoanTest.php` | 3 | Part 15 |
| `AttendanceTest.php` | 3 | Part 15 |
| `DocumentTest.php` | 3 | Part 15 |

### Test strategies
- Most Feature tests use **custom minimal schema** (drop + recreate per test)
- `AuthSessionTest` uses **RefreshDatabase**
- All tests run against PostgreSQL (`127.0.0.1:5435`)

---

## 16. Security

### Tenant isolation
- Global `TenantScope` on every tenant-owned model
- PostgreSQL RLS policies on all tenant tables
- `TenantAwareJob` for queued workers
- Route model bindings enforce tenant scoping

### Money safety
- All monetary arithmetic uses `bcmath` strings
- `Money.php` centralizes rounding and comparison

### Secrets
- Password reset tokens: hashed at rest
- Invitation tokens: hashed at rest
- 2FA recovery codes: bcrypt hashed
- API keys: Sanctum plaintext shown once, hash persisted

### Rate limiting
- Login: 5/min per email+IP
- 2FA verification: 5/min per user+IP

---

## 17. Troubleshooting

### "could not find driver" (pgsql)
PostgreSQL is not running or PHP pgsql extension is missing. Start the `db` service:
```bash
docker compose up -d db
```

### Route list crashes with ReflectionException
A controller class is referenced in `routes/api.php` but the namespace or filename is wrong. Verify imports match actual class locations.

### RecoveryCode whereHas throws RelationNotFoundException
The `RecoveryCode` model must have a `twoFactorAuthentication()` relationship. See `app/Models/RecoveryCode.php`.

### TOTP codes rejected when they should be valid
Check that the loop variable in `TwoFactorAuthenticationService::verifyCode()` is not shadowed by the truncation offset variable.

### 2FA login verify says "Invalid or expired login challenge"
The `challenge_id` must match the one stored in session during the initial `/login` call. The session must be preserved between the two requests (cookie-based).

### Session tracking shows no sessions for API tokens
`AccountSessionController` currently tracks Laravel web sessions. Sanctum API token sessions are not tracked in `user_sessions` — this is a known gap.

### destroyOthers revokes wrong sessions
Fixed in current code. The query now uses `whereNull('revoked_at')` + excludes current session.

---

*Last updated: 2026-09-13*

---

## 15. API Keys & Webhooks (Part 18)

### API Keys
- **Schema**: `api_keys`, `api_key_permissions`, `api_key_usage`
- **Model**: `App\Models\ApiKey` — `BelongsToTenant`, `HasUuids`, `prefix` (first 8 of SHA256),
  `secret_hash` (never plaintext), status helpers.
- **Controller**: `App\Http\Controllers\Api\V1\ApiKeyController`
  - `GET /v1/settings/api-keys` — list tenant keys
  - `POST /v1/settings/api-keys` — create, returns `plain_secret` once
  - `GET /v1/settings/api-keys/{id}` — show
  - `PUT|PATCH /v1/settings/api-keys/{id}` — update name/permissions/status
  - `DELETE /v1/settings/api-keys/{id}` — soft-delete (revoke)
  - `POST /v1/settings/api-keys/{id}/regenerate` — rotate secret, returns new `plain_secret`
- **Policy**: `ApiKeyPolicy` — requires `api-keys.view` / `api-keys.manage`
- **Resource**: `ApiKeyResource`, `ApiKeyPermissionResource`

### Webhook Endpoints
- **Schema**: `webhook_endpoints`, `webhook_delivery_logs`
- **Model**: `App\Models\WebhookEndpoint` — `BelongsToTenant`, `events` JSONB cast
- **Controller**: `App\Http\Controllers\Api\V1\WebhookEndpointController`
  - `GET /v1/settings/webhook-endpoints`
  - `POST /v1/settings/webhook-endpoints`
  - `GET /v1/settings/webhook-endpoints/{id}`
  - `PUT|PATCH /v1/settings/webhook-endpoints/{id}`
  - `DELETE /v1/settings/webhook-endpoints/{id}` — disable
  - `GET /v1/settings/webhook-endpoints/{id}/delivery-logs`
- **Policy**: `WebhookEndpointPolicy` — requires `webhooks.view` / `webhooks.manage`
- **Resource**: `WebhookEndpointResource`
- **Delivery**: `App\Jobs\DeliverWebhook` — 6 tries, backoff `[5, 30, 120, 600, 3600, 21600]`,
  HMAC-SHA256 via `secret_ciphertext`, `X-Webhook-Signature` header.
- **Fan-out**: `App\Listeners\DispatchOutboundWebhooks` on `PayrollRunCompleted` and
  `PaymentSettled`.

### Audit Log
- **Schema**: `audit_logs`
- **Model**: `App\Models\AuditLog` — `BelongsToTenant`, `morphTo` `auditable`, `old_values` /
  `new_values` JSONB.
- **Trait**: `App\Models\Concerns\Auditable` — writes `created`/`updated`/`deleted` rows on
  models that use it.
- **Controller**: `App\Http\Controllers\Api\V1\AuditLogController`
  - `GET /v1/settings/audit-logs` — filterable by action, user_id, auditable_type, date range
  - `GET /v1/settings/audit-logs/{id}`
- **Policy**: `AuditLogPolicy` — requires `audit.view`
- **Resource**: `AuditLogResource`

### Routes
All mounted under `auth:sanctum`:
```
settings/api-keys
settings/api-keys/{apiKey}/regenerate
settings/webhook-endpoints
settings/webhook-endpoints/{webhookEndpoint}/delivery-logs
settings/audit-logs
settings/audit-logs/{auditLog}
```

### Tests
- `tests/Feature/ApiKeysWebhooksAuditLogsTest.php` — 4 tests covering:
  - API key CRUD cycle
  - Secret regeneration
  - Webhook endpoint CRUD cycle
  - Audit log indexing and filtering

### Tenancy
All three domains use `BelongsToTenant` global scope + tenant-scoped route bindings in
`AppServiceProvider` (`apiKey`, `webhookEndpoint`, `auditLog`). RLS policies already cover
`api_keys`, `api_key_permissions`, `api_key_usage`, `webhook_endpoints`, `webhook_delivery_logs`,
and `audit_logs`.

### Security
- No secret/plaintext token is ever persisted for API keys or webhooks.
- `secret_hash` uses Laravel `Hash::make`; webhook `secret_ciphertext` uses `Crypt`.
- Audit log captures actor, IP, and user-agent automatically.

---

## 16. Accounting Integrations (Part 19)

### Why
PayrollFiti must sync payroll runs and invoices into external accounting platforms (Xero, QuickBooks, Zoho Books) so customers don't have to manually double-enter financial data. The sync is best-effort and asynchronous — a slow accounting API must never delay payslip delivery.

### Requirements (from Build Guide)
- OAuth2 authorization-code flow for Xero, QuickBooks, Zoho Books.
- `AccountingProvider` interface: `syncPayrollRun(PayrollRun, mappings): SyncResult`, `syncInvoice(invoice, mappings): SyncResult`.
- Async sync via `integrations` queue (isolated from payroll/email queues).
- Failures surfaced on per-tenant integration-health dashboard, not silently retried forever.
- Encrypted token storage (`access_token_encrypted`, `refresh_token_encrypted`) per tenant per platform.

### Architecture
```
PayrollRunCompleted event
    ↓
SyncPayrollToAccounting listener (integrations queue)
    ↓
SyncAccountingConnection job (per connection, idempotent)
    ↓
AccountingProviderManager → XeroProvider / QuickBooksProvider / ZohoBooksProvider
    ↓
External accounting API (Xero / QuickBooks / Zoho)
```

### Database
- `accounting_connections` — OAuth tokens (encrypted), provider, status, external_account_id
- `accounting_mappings` — local-to-external code mappings (e.g., payroll expense account)
- `accounting_sync_jobs` — unit of work per sync attempt
- `accounting_sync_records` — row-level result, unique per (job, entity_type, local_id)

All tables have `tenant_id`, UUID PKs, and RLS enabled.

### Backend
- **Contracts** (`App\Domain\Accounting\Contracts\`):
  - `AccountingProvider` interface
  - `SyncStatus` enum (`synced`, `failed`, `skipped`, `pending_external`)
  - `SyncResult` readonly DTO
- **Manager** (`App\Domain\Accounting\AccountingProviderManager`): in-memory registry keyed by provider name
- **Providers** (`App\Infrastructure\Accounting\`):
  - `XeroProvider` — OAuth via Socialite `xero` driver, Xero API calls
  - `QuickBooksProvider` — OAuth via Socialite `quickbooks` driver, Intuit API calls
  - `ZohoBooksProvider` — OAuth via Socialite `zoho-books` driver, Zoho Books API calls
  - `GenericOAuth2Provider` — custom Socialite `Two\AbstractProvider` that reads OAuth endpoints from `config/services.php` per platform
- **Job** (`App\Jobs\SyncAccountingConnection`): `TenantAwareJob`, `ShouldBeUnique`, loads mappings, resolves provider, calls sync, updates records
- **Listener** (`App\Listeners\SyncPayrollToAccounting`): wired to `PayrollRunCompleted` in `EventServiceProvider`
- **Controllers**:
  - `AccountingConnectionController` — CRUD + sync jobs list
  - `AccountingOAuthController` — redirect to provider + OAuth callback
- **Policies**: `AccountingConnectionPolicy` — requires `accounting.view` / `accounting.manage`
- **Resources**: `AccountingConnectionResource`, `AccountingSyncJobResource`

### OAuth Flow
1. Frontend: `POST /v1/settings/accounting/connections/{provider}/oauth/redirect` → returns `{ redirect_url }`
2. Frontend redirects user to provider's OAuth consent page
3. Provider redirects to `GET /api/accounting/integrations/callback/{provider}`
4. Backend exchanges code for tokens, stores encrypted in `accounting_connections`

**Session requirement:** Both OAuth routes use `web` middleware so Socialite can store OAuth state in the session. The redirect endpoint stores tenant/company/provider context in the session; the callback reads it. Frontend must send cookies with credentials for session to persist across the provider redirect.

### API
```
POST   /v1/settings/accounting/connections/{provider}/oauth/redirect   (auth:sanctum + web)
GET    /api/accounting/integrations/callback/{provider}                (auth:sanctum + web)
GET    /v1/settings/accounting/connections                            (auth:sanctum)
POST   /v1/settings/accounting/connections                            (auth:sanctum)
GET    /v1/settings/accounting/connections/{id}                       (auth:sanctum)
PUT    /v1/settings/accounting/connections/{id}                       (auth:sanctum)
DELETE /v1/settings/accounting/connections/{id}                       (auth:sanctum)
GET    /v1/settings/accounting/connections/{id}/sync-jobs             (auth:sanctum)
```

### Queues
- `integrations` queue — isolated from `payroll`, `notifications`, `email`, `webhooks`
- Horizon supervisor configured with `tries => 5`, `backoff => [30, 120, 600, 3600]`
- `SyncAccountingConnection` is `ShouldBeUnique` + `WithoutOverlapping` — idempotent per (connection, entity_type, local_id)

### Security
- OAuth tokens stored encrypted (`Crypt::encrypt`)
- Refresh tokens never exposed in API responses
- Tenant isolation enforced via `BelongsToTenant` + RLS + tenant-scoped route binding (`accountingConnection`)
- Authorization: `accounting.view` / `accounting.manage` permissions
- External API calls use connection's encrypted access token, refreshed automatically when expired

### Tenancy
- All accounting tables scoped to `tenant_id`
- `AccountingConnectionPolicy` enforces tenant match
- Route binding `accountingConnection` scopes queries to authenticated user's tenant
- RLS policies enabled on all 4 accounting tables in `2026_09_10_202014_enable_tenant_rls.php`

### Idempotency
- `accounting_sync_records` unique constraint `(accounting_sync_job_id, entity_type, local_id)` prevents duplicate records
- `ShouldBeUnique` + `WithoutOverlapping` on `SyncAccountingConnection` prevents concurrent duplicate jobs
- Missing credentials → deterministic `pending_external` (not a failure)

### Testing
- `tests/Feature/AccountingIntegrationTest.php` — 6 tests:
  - Accounting connection CRUD cycle
  - OAuth redirect returns provider URL
  - OAuth redirect requires `company_id`
  - Cross-tenant access denied (404)
  - User without `accounting.manage` permission denied (403)
  - Sync jobs listing for a connection

Note: Tests require PostgreSQL at `127.0.0.1:5435`. In environments without Postgres, tests will fail at the DB driver level (same pattern as other feature tests in this project).

### External Integrations
- Xero: `https://api.xero.com/api.xro/2.0/ManualJournals` and `Invoices`
- QuickBooks: `https://quickbooks.api.intuit.com/v3/company/{realmId}/journalentry` and `invoice`
- Zoho Books: `https://books.zoho.com/api/v3/journalentries` and `invoices`

Token refresh uses each platform's OAuth token endpoint. Provider classes are intentionally thin — adding a fourth platform means one new class implementing `AccountingProvider` + one registry entry in `AccountingServiceProvider`.
