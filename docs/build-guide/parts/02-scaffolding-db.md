# Part 2 — Scaffolding & Database Schema

## 2.1 Monorepo Setup

Initialize the workspace with pnpm and Turborepo:

```bash
mkdir payrollfiti && cd payrollfiti
pnpm init
pnpm add -Dw turbo typescript prettier eslint

mkdir -p apps/web apps/api packages/payroll-rules packages/pricing packages/api
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Root `package.json` scripts delegate everything to Turborepo, which fans work out to whichever workspaces define the matching script and caches results by content hash:

```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "turbo run db:generate",
    "db:push": "turbo run db:push"
  }
}
```

`turbo.json` declares every environment variable the tasks depend on (so Turborepo's cache correctly invalidates when they change) and the output globs to cache per task:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "globalEnv": [
    "APP_NAME", "NODE_ENV", "PORT", "COUNTRY_DEFAULT", "CORS_ORIGIN",
    "THROTTLE_TTL", "THROTTLE_LIMIT",
    "JWT_ACCESS_SECRET", "JWT_ACCESS_EXPIRES_IN",
    "JWT_REFRESH_SECRET", "JWT_REFRESH_EXPIRES_IN",
    "PAYSTACK_SECRET_KEY",
    "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_SHORTCODE",
    "MPESA_PASSKEY", "MPESA_ENV", "MPESA_CALLBACK_URL", "MPESA_CALLBACK_TOKEN",
    "REDIS_URL", "PAYSLIP_STORAGE_DIR", "DOCUMENT_STORAGE_DIR",
    "DATABASE_URL", "ENCRYPTION_KEY",
    "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM",
    "AFRICAS_TALKING_API_KEY", "AFRICAS_TALKING_USERNAME", "AFRICAS_TALKING_SENDER_ID",
    "SENTRY_DSN"
  ],
  "tasks": {
    "dev": { "cache": false, "persistent": true },
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"],
      "env": ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_NAME"]
    },
    "lint": {},
    "test": {},
    "test:e2e": {},
    "db:generate": { "cache": false },
    "db:push": { "cache": false },
    "db:seed": { "cache": false }
  }
}
```

Scaffold the two apps:

```bash
cd apps/web && pnpm create next-app@latest . --typescript --tailwind --app --turbopack
cd ../api && pnpm dlx @nestjs/cli new . --skip-git --package-manager pnpm
```

## 2.2 Local Infrastructure — Docker Compose

Postgres and Redis run in containers even in local dev; the API and web images are built the same way for a `docker compose up` production-like smoke test. The key detail worth calling out is the healthchecks: neither the `node:20-alpine` API image nor the web image ships `curl` or `wget`, so healthchecks shell out to Node's built-in `http` module instead of pulling in a package just for this:

```yaml
name: payrollfiti

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-payrollfiti}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-payrollfiti}
      POSTGRES_DB: ${POSTGRES_DB:-payrollfiti}
    ports: ["5432:5432"]
    volumes: ["db-data:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-payrollfiti}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile }
    environment:
      # ...full env list, see Part 12 Appendix
      DATABASE_URL: postgresql://${POSTGRES_USER:-payrollfiti}:${POSTGRES_PASSWORD:-payrollfiti}@db:5432/${POSTGRES_DB:-payrollfiti}
      REDIS_URL: redis://redis:6379
    ports: ["3000:3000"]
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3000/health', res => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:-http://localhost:3000}
    ports: ["3001:3001"]
    depends_on:
      api: { condition: service_healthy }
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/', res => process.exit(res.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))\""]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 15s

volumes:
  db-data:
```

Note `web`'s `depends_on` uses `condition: service_healthy` on `api`, not just "started" — the frontend container won't be marked ready by Compose until the API has actually passed its own healthcheck (Postgres + Redis reachable), which matters for any orchestration that waits on service health before routing traffic.

## 2.3 Database Schema — Full Walkthrough

The schema is organized around six clusters. Read them in this order — each cluster depends conceptually on the one before it.

### Cluster 1: Tenancy & Identity

```prisma
enum Role {
  ADMIN
  HR
  EMPLOYEE
}

model Tenant {
  id              String          @id @default(uuid())
  name            String
  countryCode     String
  defaultCurrency String          @default("KES")
  settings        Json?
  branding        BrandingConfig?
  companies       Company[]
  users           User[]
  subscription    Subscription?
  // ...invoices, usageRecords, auditLogs, notifications, apiKeys,
  //    webhookEndpoints, salaryComponents, leaveTypes, loans
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

`Tenant` is the SaaS customer boundary — every row that needs isolation carries a `tenantId` back to it, directly or through a parent. **Scope decision:** a tenant runs payroll in exactly one currency, derived from its `countryCode` via the shared pricing catalog. There is no FX conversion logic anywhere in the codebase; `currency` fields on `Company`, `Employee`, `SalaryStructure`, `PayrollRun`, etc. are accounting labels, not convertible amounts. `PayrollService` actively rejects running a payroll for an employee whose salary-structure currency doesn't match the run's country currency, rather than silently mixing currencies into one run's totals.

```prisma
model BrandingConfig {
  id             String @id @default(uuid())
  tenantId       String @unique
  tenant         Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  appName        String?
  logoUrl        String?
  primaryColor   String?
  secondaryColor String?
}

model Company {
  id          String       @id @default(uuid())
  tenantId    String
  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  currency    String       @default("KES")
  employees   Employee[]
  payrollRuns PayrollRun[]

  @@index([tenantId])
}

model User {
  id               String    @id @default(uuid())
  tenantId         String
  tenant           Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email            String    @unique
  passwordHash     String
  role             Role      @default(EMPLOYEE)
  isActive         Boolean   @default(true)
  refreshTokenHash String?
  phone            String?   // E.164; SMS delivery target only
  employeeId       String?   @unique
  employee         Employee? @relation(fields: [employeeId], references: [id])
  // ...auditLogs, notifications, apiKeysCreated, approved/recorded relations

  @@index([tenantId])
}
```

`BrandingConfig` is a per-tenant white-label override — payslip PDFs and the app shell fall back to the `APP_NAME` env var when it's absent. `User.employeeId` is the load-bearing detail for the employee self-service portal: when a user's `role` is `EMPLOYEE`, this optional 1:1 link lets "my payslips" / "my leave requests" endpoints resolve the caller's own employee record without trusting a client-supplied ID.

### Cluster 2: Employee Records

```prisma
enum EmploymentType { PERMANENT CONTRACT CASUAL INTERN }

model Employee {
  id                String         @id @default(uuid())
  companyId         String
  company           Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  employeeNumber    String?
  firstName         String
  lastName          String
  email             String         @unique
  kraPin            String?
  nssfNumber        String?
  nhifNumber        String?
  taxIdNumber       String?        // Nigeria TIN / SA SARS reference — non-KE countries
  pensionNumber     String?        // Nigeria RSA PIN — non-KE countries
  jobRole           String?
  department        String?
  employmentType    EmploymentType @default(PERMANENT)
  currency          String         @default("KES")
  status            String         @default("ACTIVE")
  terminatedAt      DateTime?
  terminationReason String?
  bankName          String?
  bankAccountNumber String?
  bankCode          String?
  bankBranchCode    String?
  user              User?
  contracts         Contract[]
  salaryStructures  SalaryStructure[]
  documents         Document[]
  payrollEntries    PayrollEntry[]
  leaveBalances     LeaveBalance[]
  leaveRequests     LeaveRequest[]
  attendanceRecords AttendanceRecord[]
  loans             Loan[]
  onboardingTasks   OnboardingTask[]

  @@index([companyId])
}
```

Statutory ID fields are deliberately split: `kraPin`/`nssfNumber`/`nhifNumber` are Kenya-specific (named after their actual Kenyan institutions), while `taxIdNumber`/`pensionNumber` are the generic equivalents used by Nigeria and South Africa. This keeps the schema honest about which fields are truly country-agnostic versus which encode Kenya-specific naming, without needing a fully generic key-value bag.

```prisma
model OnboardingTask {
  id          String    @id @default(uuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  title       String
  isRequired  Boolean   @default(true)
  completed   Boolean   @default(false)
  completedAt DateTime?
  order       Int       @default(0)

  @@index([employeeId])
}

model Contract {
  id         String         @id @default(uuid())
  employeeId String
  employee   Employee       @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  type       EmploymentType
  startDate  DateTime
  endDate    DateTime?
  terms      Json?

  @@index([employeeId])
}
```

A default onboarding checklist (universal items + country-specific ones, e.g. "collect KRA PIN" for a KE employee) is seeded whenever an employee is created. An employee stays in an `ONBOARDING` status — excluded from payroll runs and from active-employee billing counts — until every `isRequired` task is complete.

### Cluster 3: Compensation

```prisma
enum SalaryComponentType { EARNING DEDUCTION }
enum SalaryComponentCalcType { FIXED PERCENTAGE_OF_BASIC }

model SalaryStructure {
  id            String    @id @default(uuid())
  employeeId    String
  employee      Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  basicSalary   Float
  allowances    Json?     // LEGACY — kept for backward compat; see SalaryComponent fallback
  currency      String
  effectiveFrom DateTime
  effectiveTo   DateTime?
  components    SalaryStructureComponent[]

  @@index([employeeId, effectiveFrom])
}

model SalaryComponent {
  id             String                     @id @default(uuid())
  tenantId       String
  tenant         Tenant                     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name           String
  code           String                     // stable key, e.g. "TRANSPORT"
  type           SalaryComponentType
  calcType       SalaryComponentCalcType    @default(FIXED)
  isTaxable      Boolean                    @default(true)
  isActive       Boolean                    @default(true)
  defaultAmount  Float?                     // used when calcType = FIXED
  defaultRate    Float?                     // percentage points, when calcType = PERCENTAGE_OF_BASIC
  structureLines SalaryStructureComponent[]

  @@unique([tenantId, code])
  @@index([tenantId])
}

model SalaryStructureComponent {
  id                String          @id @default(uuid())
  salaryStructureId String
  salaryStructure   SalaryStructure @relation(fields: [salaryStructureId], references: [id], onDelete: Cascade)
  salaryComponentId String
  salaryComponent   SalaryComponent @relation(fields: [salaryComponentId], references: [id])
  amount            Float?          // overrides defaultAmount
  rate              Float?          // overrides defaultRate

  @@unique([salaryStructureId, salaryComponentId])
  @@index([salaryStructureId])
}
```

`SalaryStructure` is versioned by `effectiveFrom`/`effectiveTo` rather than mutated in place — a payslip generated last month must keep reflecting the salary that was actually in effect then, even after a raise takes effect this month. `SalaryComponent` is a tenant-defined catalog of named earnings/deductions (transport allowance, union dues, etc.) that a company can attach per employee via `SalaryStructureComponent`, each optionally overriding the component's tenant-wide default amount or rate. The legacy `allowances` JSON field on `SalaryStructure` predates this component system and is kept only as a fallback read path for structures created before it existed.

### Cluster 4: Payroll Execution

```prisma
enum PayrollRunStatus { DRAFT PROCESSING COMPLETED FAILED }

model PayrollRun {
  id             String           @id @default(uuid())
  companyId      String
  company        Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  period         String
  periodStart    DateTime
  periodEnd      DateTime
  countryCode    String
  currency       String
  ruleVersion    String
  status         PayrollRunStatus @default(DRAFT)
  idempotencyKey String           @unique
  totals         Json?
  initiatedById  String?
  isOffCycle     Boolean          @default(false)
  reason         String?
  entries        PayrollEntry[]

  @@index([companyId, period])
}

model PayrollEntry {
  id                       String     @id @default(uuid())
  payrollRunId             String
  payrollRun               PayrollRun @relation(fields: [payrollRunId], references: [id], onDelete: Cascade)
  employeeId               String
  employee                 Employee   @relation(fields: [employeeId], references: [id])
  currency                 String
  prorationFactor          Float      @default(1)
  grossPay                 Float
  totalTax                 Float
  totalStatutoryDeductions Float
  totalVoluntaryDeductions Float
  totalDeductions          Float
  netPay                   Float
  earningsBreakdown        Json
  statutoryDeductions      Json
  taxBreakdown             Json
  inputHash                String
  payslip                  Payslip?
  correctionsAsOriginal    PayrollCorrection[] @relation("OriginalEntry")
  correctionAsCorrected    PayrollCorrection?  @relation("CorrectedEntry")
  loanRepayments           LoanRepayment[]

  @@index([payrollRunId])
  @@index([employeeId])
}
```

`PayrollRun.idempotencyKey` is `@unique` — re-submitting the same run request returns the existing run instead of double-processing. `PayrollEntry` is deliberately country-agnostic: it never encodes "NSSF" or "PAYE" as columns — that detail lives inside the `earningsBreakdown`/`statutoryDeductions`/`taxBreakdown` JSON blobs, whose *shape* is produced by whichever `CountryRuleSet` ran (Part 3). This is what lets one schema serve three (and eventually more) countries without a migration per country.

```prisma
model PayrollCorrection {
  id               String       @id @default(uuid())
  originalEntryId  String
  originalEntry    PayrollEntry @relation("OriginalEntry", fields: [originalEntryId], references: [id], onDelete: Cascade)
  correctedEntryId String       @unique
  correctedEntry   PayrollEntry @relation("CorrectedEntry", fields: [correctedEntryId], references: [id], onDelete: Cascade)
  reason           String
  createdById      String?

  @@index([originalEntryId])
}

model Payslip {
  id             String       @id @default(uuid())
  payrollEntryId String       @unique
  payrollEntry   PayrollEntry @relation(fields: [payrollEntryId], references: [id], onDelete: Cascade)
  pdfPath        String?
  generatedAt    DateTime     @default(now())
}
```

When a mistake is discovered after a run completes, the fix is a *new* off-cycle `PayrollEntry` linked back via `PayrollCorrection` — the original entry is never mutated. This preserves an immutable audit trail of what was actually paid, and when, and why it was corrected.

### Cluster 5: HR Operations

```prisma
enum LeaveRequestStatus { PENDING APPROVED REJECTED }
enum AttendanceStatus { PRESENT ABSENT LEAVE }
enum LoanStatus { PENDING REJECTED ACTIVE PAID_OFF }
enum LoanRepaymentStatus { PENDING PAID SKIPPED }

model LeaveType {
  id          String @id @default(uuid())
  tenantId    String
  tenant      Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  daysPerYear Float
  isPaid      Boolean @default(true)
  isActive    Boolean @default(true)
  balances    LeaveBalance[]
  requests    LeaveRequest[]

  @@unique([tenantId, name])
}

model LeaveBalance {
  id          String    @id @default(uuid())
  employeeId  String
  employee    Employee  @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveTypeId String
  leaveType   LeaveType @relation(fields: [leaveTypeId], references: [id], onDelete: Cascade)
  year        Int
  accruedDays Float     @default(0)
  usedDays    Float     @default(0)

  @@unique([employeeId, leaveTypeId, year])
}

model LeaveRequest {
  id            String             @id @default(uuid())
  employeeId    String
  employee      Employee           @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  leaveTypeId   String
  leaveType     LeaveType          @relation(fields: [leaveTypeId], references: [id])
  startDate     DateTime
  endDate       DateTime
  daysRequested Float
  reason        String?
  status        LeaveRequestStatus @default(PENDING)
  approverId    String?
  approver      User?              @relation(fields: [approverId], references: [id])
  decidedAt     DateTime?

  @@index([employeeId, status])
}

model Loan {
  id                String          @id @default(uuid())
  tenantId          String
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  employeeId        String
  employee          Employee        @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  principal         Float
  currency          String
  installments      Int
  installmentAmount Float?
  startPeriod       String          // "YYYY-MM" — first period the deduction applies from once approved
  reason            String?
  status            LoanStatus      @default(PENDING)
  requestedById     String?
  requestedBy       User?           @relation("LoanRequestedBy", fields: [requestedById], references: [id])
  approvedById      String?
  approvedBy        User?           @relation("LoanApprovedBy", fields: [approvedById], references: [id])
  decidedAt         DateTime?
  closedAt          DateTime?
  repayments        LoanRepayment[]

  @@index([employeeId, status])
}

model LoanRepayment {
  id             String              @id @default(uuid())
  loanId         String
  loan           Loan                @relation(fields: [loanId], references: [id], onDelete: Cascade)
  installmentNo  Int
  period         String
  amountDue      Float
  amountPaid     Float               @default(0)
  status         LoanRepaymentStatus @default(PENDING)
  payrollEntryId String?
  payrollEntry   PayrollEntry?       @relation(fields: [payrollEntryId], references: [id])
  paidAt         DateTime?

  @@unique([loanId, installmentNo])
  @@index([period, status])
}
```

`installmentAmount` and the full `LoanRepayment` schedule are only generated once a loan transitions to `ACTIVE` (approved) — a `REJECTED` loan never ties up a future payroll period. `LoanRepayment.payrollEntryId` is set only once an installment is actually deducted through a real payroll run; an early payoff instead marks the remaining rows `SKIPPED` without ever populating it, so the schema can always answer "was this installment actually paid through payroll, or written off?"

```prisma
model Document {
  id           String   @id @default(uuid())
  employeeId   String
  employee     Employee @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  type         String
  fileName     String
  mimeType     String
  sizeBytes    Int
  url          String   // relative path under DOCUMENT_STORAGE_DIR
  uploadedById String?
  uploadedBy   User?    @relation(fields: [uploadedById], references: [id])
  uploadedAt   DateTime @default(now())

  @@index([employeeId, type])
}

model AttendanceRecord {
  id           String           @id @default(uuid())
  employeeId   String
  employee     Employee         @relation(fields: [employeeId], references: [id], onDelete: Cascade)
  date         DateTime
  status       AttendanceStatus
  notes        String?
  recordedById String?
  recordedBy   User?            @relation(fields: [recordedById], references: [id])

  @@unique([employeeId, date])
}
```

### Cluster 6: Billing, Audit, Platform

```prisma
enum SubscriptionStatus { TRIALING ACTIVE PAST_DUE CANCELED }
enum InvoiceStatus { DRAFT OPEN PAID VOID UNCOLLECTIBLE }
enum PaymentProviderType { PAYSTACK MPESA }

model Plan {
  id               String @id @default(uuid())
  code             String @unique
  name             String
  pricePerEmployee Float
  currency         String @default("USD")
  tier             String?
  countryCode      String? // null = legacy/global plan not tied to a country catalog
  isActive         Boolean @default(true)
  subscriptions    Subscription[]

  @@index([countryCode])
}

model Subscription {
  id                     String              @id @default(uuid())
  tenantId               String              @unique
  tenant                 Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  planId                 String
  plan                   Plan                @relation(fields: [planId], references: [id])
  status                 SubscriptionStatus  @default(TRIALING)
  provider               PaymentProviderType @default(PAYSTACK)
  providerCustomerId     String?
  providerSubscriptionId String?
  currentPeriodStart     DateTime
  currentPeriodEnd       DateTime
  invoices               Invoice[]
}

model Invoice {
  id                String        @id @default(uuid())
  tenantId          String
  tenant            Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  subscriptionId    String
  subscription      Subscription  @relation(fields: [subscriptionId], references: [id])
  amount            Float
  currency          String
  status            InvoiceStatus @default(DRAFT)
  dueDate           DateTime
  paidAt            DateTime?
  provider          PaymentProviderType @default(PAYSTACK)
  providerInvoiceId String?
  transactions      PaymentTransaction[]

  @@index([tenantId, status])
}

model UsageRecord {
  id            String   @id @default(uuid())
  tenantId      String
  tenant        Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  period        String
  employeeCount Int
  computedAt    DateTime @default(now())

  @@unique([tenantId, period])
}

// Raw log of provider-side attempts against an invoice, kept for
// reconciliation independent of invoice.status.
model PaymentTransaction {
  id          String              @id @default(uuid())
  invoiceId   String
  invoice     Invoice             @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  provider    PaymentProviderType
  reference   String
  amount      Float
  currency    String
  status      String
  rawResponse Json?

  @@index([invoiceId])
}
```

```prisma
// Append-only trail of who changed what. Interceptor-populated (Part 4),
// never updated or deleted by application code.
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  actorId    String?
  actor      User?    @relation(fields: [actorId], references: [id])
  action     String
  entityType String
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?

  @@index([tenantId, entityType, entityId])
  @@index([tenantId, createdAt])
}

model Notification {
  id       String  @id @default(uuid())
  tenantId String
  tenant   Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId   String
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  type     String
  message  String
  read     Boolean @default(false)
  metadata Json?

  @@index([userId, read])
}

// Machine credential for the read-only public API. hashedKey is a one-way
// SHA-256 digest of a server-generated high-entropy token — the raw key is
// never stored (Part 9).
model ApiKey {
  id          String    @id @default(uuid())
  tenantId    String
  tenant      Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  name        String
  hashedKey   String    @unique
  keyPrefix   String
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdById String?
  createdBy   User?     @relation(fields: [createdById], references: [id])

  @@index([tenantId])
}

// Tenant-configured outbound webhook subscription. `secret` is stored
// retrievable — unlike ApiKey.hashedKey — because the server uses it to SIGN
// outgoing deliveries rather than verify an inbound presentation of it.
model WebhookEndpoint {
  id         String               @id @default(uuid())
  tenantId   String
  tenant     Tenant               @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  url        String
  secret     String
  events     String[]
  isActive   Boolean              @default(true)
  deliveries WebhookDeliveryLog[]

  @@index([tenantId])
}

model WebhookDeliveryLog {
  id                String          @id @default(uuid())
  webhookEndpointId String
  webhookEndpoint   WebhookEndpoint @relation(fields: [webhookEndpointId], references: [id], onDelete: Cascade)
  event             String
  payload           Json
  statusCode        Int?
  success           Boolean
  error             String?

  @@index([webhookEndpointId, createdAt])
}
```

### Migrations

Every schema change is a Prisma migration, generated and applied together — never edited by hand after generation:

```bash
pnpm --filter api exec prisma migrate dev --name add_employee_department
```

This writes a timestamped SQL file under `apps/api/prisma/migrations/` and applies it to the local database in one step. In CI/production, `prisma migrate deploy` applies any pending migrations without generating new ones or prompting — the deploy pipeline never has interactive access to decide on schema changes, only to apply already-reviewed ones.
