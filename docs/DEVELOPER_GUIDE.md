# PayrollFiti Developer Guide

> **Complete engineering playbook for PayrollFiti development**

## Quick Reference

### Repository Structure
```
payrollfiti/
├── apps/
│   ├── api/                 # Laravel Backend
│   │   ├── app/Domain/      # Domain layer (Payroll, Compliance)
│   │   ├── app/Http/        # Controllers, Requests, Resources
│   │   ├── app/Models/      # Eloquent models
│   │   ├── app/Policies/    # Authorization policies
│   │   ├── database/        # Migrations, seeders
│   │   └── routes/         # API routes
│   │
│   └── web/                 # Next.js Frontend
│
├── docker-compose.yml
├── docs/
└── README.md
```

### Essential Commands
```bash
# Start services
docker compose up -d

# Run tests
docker compose exec api php artisan test

# Run specific test
docker compose exec api php artisan test --filter ComplianceReportTest

# Database migrations
docker compose exec api php artisan migrate

# Generate app key
docker compose exec api php artisan key:generate
```

---

## 1. Technology Stack

### Backend
- **Framework**: Laravel 13
- **Database**: PostgreSQL 15+ with RLS
- **Cache/Queue**: Redis 7+
- **Storage**: MinIO (S3-compatible)
- **Auth**: Laravel Sanctum
- **RBAC**: Spatie Laravel Permission
- **Queues**: Laravel Horizon

### Frontend
- **Framework**: Next.js 14+
- **State**: React Query
- **Styling**: Tailwind CSS

---

## 2. Architecture Overview

### System Architecture
```
User Browser → Next.js Frontend → Laravel API → PostgreSQL
                          ↓        ↓
                     Redis Cache   MinIO Storage
                          ↓
                     Queue Workers
```

### Domain Boundaries
- **Payroll Domain**: `app/Domain/Payroll/` - Payroll calculation, rules
- **Compliance Domain**: `app/Domain/Compliance/` - Report generation
- **Application Layer**: `app/Http/` - Controllers, requests, resources
- **Data Layer**: `app/Models/` - Eloquent models, database

---

## 3. Multi-Tenancy

### Tenant Isolation
All models use `BelongsToTenant` trait for automatic tenant scoping:

```php
class PayrollRun extends Model
{
    use BelongsToTenant; // Automatic tenant_id filtering
}
```

### Tenant Context
Tenant context is set via `SetCurrentTenantContext` middleware:

```php
// In routes/api.php
Route::middleware(['auth:sanctum', SetCurrentTenantContext::class])->group(...);
```

**Security Rules:**
✅ DO use tenant-aware models  
✅ DO verify tenant access in policies  
❌ DO NOT trust client-supplied tenant_id  
❌ DO NOT bypass tenant scopes  

---

## 4. Payroll Engine

### Architecture
```
Request → RunPayrollCommand → PayrollCalculator → RuleRegistry → CountryRuleSet → Result
```

### Key Components
- `RuleRegistry`: Resolves country-specific rule sets
- `PayrollCalculator`: Core calculation engine
- `CountryRuleSet`: Interface for country rules
- `RunPayrollCommand`: Handles payroll execution

### Supported Countries
- Kenya (KE) - Kenya2024RuleSet, Kenya2025RuleSet
- Nigeria (NG) - Nigeria2024RuleSet
- South Africa (ZA) - SouthAfrica2024RuleSet

---

## 5. Compliance Architecture

### Country-Gated Design
Compliance reports are country-specific and gated by company country:

```php
// CountryComplianceRegistry resolves generators by country
$generator = $registry->resolve('KE'); // Kenya
$generator = $registry->resolve('UG'); // Uganda
```

### Template-Driven Reports
Each country has its own generator:
- Kenya: KE-P9 report
- Nigeria: NG-PAYE report
- South Africa: ZA-PAYE report
- Uganda: UG-PAYE report (4th country)

### Key Principle
**Compliance reports consume PERSISTED payroll entries - they NEVER recalculate payroll.**

---

## 6. API Endpoints

### Compliance Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/compliance/reports` | List reports |
| POST | `/api/v1/compliance/reports` | Generate report |
| GET | `/api/v1/compliance/reports/{id}` | Get report details |
| POST | `/api/v1/payroll/runs/{run}/compliance` | Generate for run |

### Payroll Runs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/payroll/runs` | List runs |
| POST | `/api/v1/payroll/runs` | Create run |
| GET | `/api/v1/payroll/runs/{id}` | Get run details |
| POST | `/api/v1/payroll/runs/{id}/approve` | Approve run |
| POST | `/api/v1/payroll/runs/{id}/finalize` | Finalize run |

---

## 7. Authorization

### Permissions
```php
// Available permissions
'payroll.view'       - View payroll runs
'payroll.manage'     - Create/edit payroll runs
'compliance.view'    - View compliance reports
'compliance.generate' - Generate compliance reports
'employees.manage'   - Manage employees
```

### Assigning Permissions
```php
// To user
$user->givePermissionTo(['payroll.view', 'compliance.generate']);

// To role
$role->givePermissionTo(['payroll.manage']);
$user->assignRole('payroll-admin');
```

---

## 8. Adding a New Country

### Step-by-Step Process

1. **Create Rule Set**
   ```bash
   mkdir -p apps/api/app/Domain/Payroll/Engine/Rules/ABC
   ```

2. **Implement CountryRuleSet**
   ```php
   // ABC2025RuleSet.php
   final class ABC2025RuleSet implements CountryRuleSet
   {
       public function countryCode(): string { return 'ABC'; }
       public function version(): string { return 'ABC-2025.1'; }
       // ... implement all methods
   }
   ```

3. **Register Rule Set**
   ```php
   // RuleRegistry.php
   'ABC' => [new ABC2025RuleSet],
   ```

4. **Create Compliance Generator**
   ```php
   // ABCComplianceGenerator.php
   final class ABCComplianceGenerator extends AbstractCountryComplianceGenerator
   {
       public function countryCode(): string { return 'ABC'; }
       public function reportCode(): string { return 'ABC-FORM'; }
       public function version(): string { return 'ABC-2025.1'; }
   }
   ```

5. **Register Compliance Generator**
   ```php
   // CountryComplianceRegistry.php
   new ABCComplianceGenerator,
   ```

6. **Add Tests**
   ```php
   public function test_abc_country_report_can_be_generated() { ... }
   ```

 7. **Update Documentation**

---

## 8. 2FA & Session Management (Part 17)

### TOTP Setup (Three-Call Flow)

| Call | Method | Path | Purpose |
|------|--------|------|---------|
| 1 | POST | `/account/2fa/setup` | Generate TOTP secret + QR code |
| 2 | POST | `/account/2fa/verify` | Verify TOTP code, activate 2FA, generate recovery codes |
| 3 | POST | `/account/2fa/login/verify` | Second step of login when 2FA is enabled |

**Why three calls?** A user who abandons setup midway never ends up locked out by a half-configured factor. The secret is stored in session as PENDING until verified.

### Recovery Codes

- Generated on 2FA enable (10 codes)
- Hashed at rest using bcrypt (never stored plaintext)
- Single-use: each code is invalidated on use
- Regeneratable via `POST /account/2fa/recovery-codes`

### Session Management

Sessions are tracked in the `user_sessions` table:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/account/sessions` | List all sessions with device/browser/IP |
| DELETE | `/account/sessions/{id}` | Revoke a specific session |
| DELETE | `/account/sessions/others` | Revoke all sessions except current |

### Security Notes

- 2FA enforced via TOTP (RFC 6238, 6-digit codes, 30-second period)
- Rate limiting: 5 failed attempts per minute per user+IP
- Challenge ID validated against stored session using `hash_equals()`
- Tenant isolation via `BelongsToTenant` on `two_factor_authentications` and `user_sessions`

---

## 9. Testing

### Running Tests
```bash
# All tests
docker compose exec api php artisan test

# Specific test
docker compose exec api php artisan test --filter ComplianceReportTest

# With coverage
docker compose exec api php artisan test --coverage
```

### Test Structure
```
tests/Feature/
├── AuthSessionTest.php
├── TwoFactorAuthenticationTest.php  # Part 17 tests
├── Onboarding/OnboardingTaskTest.php  # Part 16 tests
├── ComplianceReportTest.php  # Part 11 tests
├── PayrollDomainTest.php
├── BillingPaymentsTest.php
├── QueueMessagingTest.php
├── NotificationSystemTest.php
├── Leave/LeaveRequestTest.php
├── Loan/LoanTest.php
├── Attendance/AttendanceTest.php
├── Documents/DocumentTest.php
└── ...
```

---

## 9a. Queues, Redis & Messaging (Part 13)

> Full reference: [QUEUES_AND_REDIS.md](architecture/QUEUES_AND_REDIS.md)

- **Redis broker**, Horizon workers; queue connection has `after_commit => true`.
- **One queue per concern**: `high`, `default`, `payroll`, `notifications`, `email`,
  `sms`, `webhooks`, `reports`, `exports`, `integrations` (see `config/horizon.php`
  for per-queue supervisors, tries, backoff, timeouts; `balance=auto` redirects idle
  capacity to `payroll` under burst load).
- **Transactional outbox**: `FinalizePayrollRun` and payment settlement write
  `outbox_events` in the same DB transaction as the state change; the
  `queue:dispatch-outbox` schedule claims rows and relays them as domain events.
- **Fan-out**: `PayrollRunCompleted` → 4 queued listeners on 4 queues;
  `PaymentSettled` → webhook listener. `EventServiceProvider` holds the explicit
  `$listen` map; `bootstrap/app.php` uses `withEvents(discover: false)` — do NOT
  register the provider in both places or every listener queues twice.
- **Tenant safety**: `TenantAwareJob` sets/closes `TenantContext` per job; queued
  listeners use plain `public $queue/$tries/$timeout` properties (no Queueable
  traits on listener classes).
- **Webhooks**: outbound payloads are HMAC-SHA256 signed and every delivery attempt
  recorded in `webhook_delivery_logs`.
- **Run it**:
  ```bash
  docker compose exec api php artisan horizon        # workers
  docker compose exec api php artisan schedule:work   # outbox relay + cron jobs
  docker compose exec api php artisan queue:dispatch-outbox  # manual drain
  ```
- **Test gotchas** (see `tests/Feature/QueueMessagingTest.php`): queued listeners
  appear as `CallQueuedListener` (assert via `listenersPushed`/`size`); `Queue::fake()`
  always installs a new empty fake; and `ShouldBeUnique` jobs acquire a cache lock at
  dispatch time — release it (`UniqueLock` + `Cache::store()`) before re-dispatching
  in tests, or the re-dispatch is silently skipped.

---

## 10. Security Best Practices

✅ **DO:**
- Use HTTPS everywhere
- Validate all inputs
- Use policies for authorization
- Scope all queries by tenant
- Use parameter binding
- Sanitize outputs

❌ **DO NOT:**
- Trust client-supplied tenant_id
- Bypass tenant scopes
- Hardcode permissions
- Log sensitive data
- Use raw SQL without protection

---

## 11. Performance

### Current Performance
- Compliance report generation: <1s for 100 employees
- API response times: <100ms for most endpoints
- Database queries: Optimized with indexes

### Performance Tips
- Use eager loading (`with()`) to avoid N+1
- Use pagination for lists
- Cache repeated calculations
- Use chunk() for large datasets

---

## 12. Deployment

### Quick Deploy
```bash
# Build and start
docker compose up -d --build

# Run migrations
docker compose exec api php artisan migrate --force

# Generate key
docker compose exec api php artisan key:generate

# Start queue workers
docker compose exec api php artisan queue:work --daemon
```

### Environment Configuration
- Copy `.env.example` to `.env`
- Set database connection
- Set Redis connection
- Set app URL
- Set encryption keys

---

## 13. Troubleshooting

### Common Issues

**"Tenant mismatch" / 403 Forbidden**
- Check tenant context is set
- Verify SetCurrentTenantContext middleware is applied

**"Country not supported" / 422**
- Check CountryComplianceRegistry for supported countries
- Verify company has valid country code

**Tests failing in CI**
- Run with `--verbose` for detailed output
- Ensure test database is properly configured

**Migration errors**
- Use `migrate:fresh` to reset completely
- Check `migrate:status` for issues

---

## 14. Production Readiness

### Checklist
- [ ] All tests pass
- [ ] Database migrations tested
- [ ] Environment secured
- [ ] Backups configured
- [ ] Monitoring set up
- [ ] Error tracking configured
- [ ] Queue workers running
- [ ] Scheduler running

---

## Documentation Links

- [Implementation Status](IMPLEMENTATION_STATUS.md) - Current project status
- [System Design](architecture/SYSTEM_DESIGN.md) - Technical architecture
- [Payroll Engine](payroll/PAYROLL_ENGINE.md) - Payroll calculation details
- [Queues & Redis](architecture/QUEUES_AND_REDIS.md) - Messaging layer (Part 13)

---

*Last updated: 2026-09-13*
*This is a living document - update it as the system evolves*