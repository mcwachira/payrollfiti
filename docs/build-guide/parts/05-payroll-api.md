# Part 5 — Core Payroll API

With the foundation from Part 4 in place, this part builds the domain modules that actually move data: employees, payroll execution, and payslip generation. Every module below follows the same skeleton — `Controller` handles HTTP + decorators, `Service` handles business logic + Prisma — so once you've built Employees, the rest are variations on the same shape.

## 5.1 Employees Module — The CRUD Template

Every write endpoint declares both `@Roles(...)` and `@RequirePermission(...)` (Part 4 §4.5); every tenant-scoped lookup goes through `CurrentTenant()` and an ownership check before touching data.

```typescript
// employees/employees.controller.ts
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Roles(Role.ADMIN, Role.HR)
  @RequirePermission(Permission.EMPLOYEE_WRITE)
  @Post()
  create(@CurrentTenant() tenantId: string, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(tenantId, dto);
  }

  @Get(':id') // no @Roles — an EMPLOYEE may read (their own record is enforced deeper, e.g. in findMine-style endpoints elsewhere)
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.employeesService.findOne(tenantId, id);
  }

  @Roles(Role.ADMIN)
  @RequirePermission(Permission.EMPLOYEE_TERMINATE)
  @Post(':id/terminate')
  terminate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Param('id') id: string,
    @Body() dto: TerminateEmployeeDto,
  ) {
    return this.employeesService.terminate(tenantId, user.id, id, dto);
  }
  // ...contracts, salary-structures, onboarding-tasks follow the same shape
}
```

**PII is encrypted on the way in, decrypted on the way out — explicitly, every time**, not through a Prisma middleware:

```typescript
// employees/employees.service.ts
@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
  ) {}

  private decryptEmployee<T extends Employee>(employee: T): T {
    return {
      ...employee,
      kraPin: this.encryptionService.decrypt(employee.kraPin),
      nssfNumber: this.encryptionService.decrypt(employee.nssfNumber),
      nhifNumber: this.encryptionService.decrypt(employee.nhifNumber),
      taxIdNumber: this.encryptionService.decrypt(employee.taxIdNumber),
      pensionNumber: this.encryptionService.decrypt(employee.pensionNumber),
      bankAccountNumber: this.encryptionService.decrypt(employee.bankAccountNumber),
    };
  }

  /**
   * New employees start in ONBOARDING, not ACTIVE — excluded from payroll
   * runs and active-employee billing counts until their checklist completes.
   */
  async create(tenantId: string, dto: CreateEmployeeDto) {
    await this.tenantsService.assertCompanyBelongsToTenant(dto.companyId, tenantId);
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { countryCode: true } });

    const created = await this.prisma.$transaction(async (tx) => {
      const employee = await tx.employee.create({
        data: {
          companyId: dto.companyId,
          firstName: dto.firstName, lastName: dto.lastName, email: dto.email,
          status: 'ONBOARDING',
          kraPin: this.encryptionService.encrypt(dto.kraPin),
          nssfNumber: this.encryptionService.encrypt(dto.nssfNumber),
          nhifNumber: this.encryptionService.encrypt(dto.nhifNumber),
          taxIdNumber: this.encryptionService.encrypt(dto.taxIdNumber),
          pensionNumber: this.encryptionService.encrypt(dto.pensionNumber),
          bankAccountNumber: this.encryptionService.encrypt(dto.bankAccountNumber),
          currency: dto.currency ?? getPricingForCountry(tenant.countryCode).currency,
          department: dto.department, jobRole: dto.jobRole, employmentType: dto.employmentType,
        },
      });
      // Default onboarding checklist, seeded in the same transaction
      const tasks = getDefaultOnboardingTasks(tenant.countryCode);
      await tx.onboardingTask.createMany({
        data: tasks.map((task, index) => ({ employeeId: employee.id, title: task.title, isRequired: task.isRequired, order: index })),
      });
      return employee;
    });
    return this.decryptEmployee(created);
  }

  async findOne(tenantId: string, employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { contracts: true, salaryStructures: true, company: true },
    });
    // Employee isn't in TENANT_SCOPED_MODELS (it's reached via Company, not
    // a direct tenantId column) — so ownership is checked explicitly here.
    if (!employee || employee.company.tenantId !== tenantId) {
      throw new NotFoundException('Employee not found');
    }
    return this.decryptEmployee(employee);
  }

  /** Salary structure in effect for a given date — used by payroll runs */
  async getActiveSalaryStructure(employeeId: string, asOf: Date) {
    return this.prisma.salaryStructure.findFirst({
      where: { employeeId, effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Full offboarding: TERMINATED status, closes any open contract, and
   * revokes portal access (deactivates the linked User, clears its refresh
   * token so an existing session can't be used past this point). Does NOT
   * attempt to prorate a final paycheck — that's a separate feature; the
   * calculation engine supports proration (Part 3 §3.4) but it isn't wired
   * to a termination date as an input source yet.
   */
  async terminate(tenantId: string, actorId: string, employeeId: string, dto: TerminateEmployeeDto) {
    const employee = await this.findOne(tenantId, employeeId);
    if (employee.status === 'TERMINATED') throw new BadRequestException('Employee is already terminated');

    const terminationDate = dto.terminationDate ? new Date(dto.terminationDate) : new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.employee.update({
        where: { id: employeeId },
        data: { status: 'TERMINATED', terminatedAt: terminationDate, terminationReason: dto.reason },
      });
      await tx.contract.updateMany({ where: { employeeId, endDate: null }, data: { endDate: terminationDate } });
      await tx.user.updateMany({ where: { employeeId }, data: { isActive: false, refreshTokenHash: null } });
      return result;
    });

    await this.auditService.record({
      tenantId, actorId, action: 'employee.terminate', entityType: 'Employee', entityId: employeeId,
      before: { status: employee.status }, after: { status: 'TERMINATED', terminatedAt: terminationDate.toISOString(), reason: dto.reason ?? null },
    });
    return this.decryptEmployee(updated);
  }
}
```

**Onboarding gate**: `completeOnboarding()` refuses to flip an employee from `ONBOARDING` to `ACTIVE` while any `isRequired` task is still incomplete — this is the actual enforcement point that keeps an incompletely-onboarded employee out of payroll runs (which filter `status: 'ACTIVE'`) and out of billing's active-employee count.

## 5.2 Payroll Module — Execution, Idempotency, Concurrency

This is the module where every earlier architectural decision pays off at once: the pure engine (Part 3), tenant scoping (Part 4), and the `PayrollEntry` schema (Part 2) all come together in `executeRun`.

**Bounded-concurrency per-employee computation.** Each employee's calculation (fetch their active salary structure, resolve salary components, resolve loan deductions, run the pure engine) is independent of every other employee's — but a plain `Promise.all` over hundreds or thousands of employees would fire that many concurrent DB queries at once and exhaust the connection pool. A small worker-pool helper bounds it:

```typescript
const RUN_COMPUTATION_CONCURRENCY = 10;

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]!); // index-based assignment preserves order
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
```

Order-preservation matters here only insofar as correctness downstream doesn't actually depend on it — `computeRunIdempotencyKey` sorts entry hashes before hashing, and `aggregateTotals` is a commutative sum — but assigning into `results[current]` by index rather than pushing keeps the result array's order predictable regardless.

**The run itself**, trimmed to the essential shape:

```typescript
private async executeRun(params: ExecuteRunParams) {
  const { tenantId, actorId, companyId, period, periodStart: periodStartInput, periodEnd: periodEndInput, employeeIds, isOffCycle, reason, force } = params;

  const company = await this.tenantsService.assertCompanyBelongsToTenant(companyId, tenantId);
  const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const periodStart = new Date(periodStartInput);
  const ruleSet = await this.rulesCache.resolve(tenant.countryCode, periodStart); // Part 3 §3.6 registry, cached

  const employees = await this.prisma.employee.findMany({
    where: { companyId: company.id, status: 'ACTIVE', ...(employeeIds ? { id: { in: employeeIds } } : {}) },
  });

  const perEmployeeResults = await mapWithConcurrency(employees, RUN_COMPUTATION_CONCURRENCY, async (employee) => {
    const salaryStructure = await this.employeesService.getActiveSalaryStructure(employee.id, periodStart);
    if (!salaryStructure) return null; // no active structure = skipped, not an error

    const { allowances, voluntaryDeductions: componentDeductions } =
      await this.salaryComponentsService.resolveStructureEarnings(salaryStructure.id, salaryStructure.basicSalary, salaryStructure.allowances);
    const { voluntaryDeductions: loanDeductions, repayments: loanRepayments } =
      await this.loansService.resolvePayrollDeductions(tenantId, employee.id, period);

    const input: PayrollCalculationInput = {
      employeeId: employee.id, countryCode: ruleSet.countryCode, currency: salaryStructure.currency,
      earnings: { basicSalary: salaryStructure.basicSalary, allowances },
      ...(Object.keys({ ...componentDeductions, ...loanDeductions }).length > 0
        ? { deductions: { voluntary: { ...componentDeductions, ...loanDeductions } } } : {}),
      period: { periodStart: periodStartInput, periodEnd: periodEndInput },
    };
    return { employee, result: runPayrollCalculation(input, ruleSet), loanRepayments };
  });
  const computations = perEmployeeResults.filter((c) => c !== null);

  // Single-currency-per-tenant enforcement: fail the WHOLE run rather than
  // silently excluding a mismatched employee — a wrong currency on a salary
  // structure is a data error, not routine payroll behavior.
  const currencyErrors = computations.flatMap(({ employee, result }) =>
    result.validation.filter((i) => i.severity === 'error' && i.field === 'currency').map((issue) => ({ employee, issue })));
  if (currencyErrors.length > 0) {
    throw new BadRequestException(`Cannot run payroll — currency mismatch for ${currencyErrors.length} employee(s): ...`);
  }

  const idempotencyKey = this.computeRunIdempotencyKey(company.id, period, ruleSet.version, computations, isOffCycle, reason);
  const existingRun = await this.prisma.payrollRun.findUnique({ where: { idempotencyKey }, include: { entries: true } });
  if (existingRun && !force) return existingRun; // re-submitting the same request is a no-op, not a duplicate run

  const totals = this.aggregateTotals(computations);
  const run = await this.prisma.$transaction(async (tx) => {
    const payrollRun = await tx.payrollRun.create({
      data: { companyId: company.id, period, periodStart, periodEnd: new Date(periodEndInput),
        countryCode: ruleSet.countryCode, currency: ruleSet.currency, ruleVersion: ruleSet.version,
        status: 'COMPLETED', idempotencyKey, totals, initiatedById: actorId, isOffCycle, reason },
    });
    for (const { employee, result } of computations) {
      await tx.payrollEntry.create({
        data: { payrollRunId: payrollRun.id, employeeId: employee.id, currency: result.currency,
          prorationFactor: result.prorationFactor, grossPay: result.grossPay, totalTax: result.tax.netTax,
          totalStatutoryDeductions: sum(result.statutoryDeductions.map((d) => d.employeeAmount)),
          totalVoluntaryDeductions: result.totalVoluntaryDeductions, totalDeductions: result.totalDeductions,
          netPay: result.netPay, earningsBreakdown: result.earnings, statutoryDeductions: result.statutoryDeductions,
          taxBreakdown: result.tax, inputHash: result.inputHash },
      });
    }
    return tx.payrollRun.findUniqueOrThrow({ where: { id: payrollRun.id }, include: { entries: true } });
  });

  await this.auditService.record({ tenantId, actorId, action: isOffCycle ? 'payroll.run.off-cycle' : 'payroll.run', entityType: 'PayrollRun', entityId: run.id, after: totals });
  await this.payslipEmailService.enqueueForRun(tenantId, run.id); // async, off the request thread (Part 8)
  for (const entry of run.entries) {
    const computation = computations.find((c) => c.employee.id === entry.employeeId);
    if (computation?.loanRepayments.length) await this.loansService.markRepaymentsPaid(computation.loanRepayments, entry.id);
  }
  await this.notificationsService.dispatchForRoles(tenantId, [Role.ADMIN, Role.HR], 'PAYROLL_RUN_COMPLETED', `Payroll run for ${run.period} has completed...`, { metadata: { runId: run.id } });
  void this.webhooksService.dispatch(tenantId, 'payroll.run.completed', { runId: run.id, totals: run.totals }).catch(() => {});

  return run;
}
```

**Idempotency key derivation** — the single most important correctness invariant in this module:

```typescript
private computeRunIdempotencyKey(companyId: string, period: string, ruleVersion: string, computations: Computation[], isOffCycle: boolean, reason?: string): string {
  const entryHashes = computations.map((c) => `${c.employee.id}:${c.result.inputHash}`).sort(); // order-independent
  const payload: Record<string, unknown> = { companyId, period, ruleVersion, entryHashes };
  if (isOffCycle) { payload.isOffCycle = true; payload.reason = reason; }
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}
```

`entryHashes` is sorted before hashing specifically so `computations`' array order — which now depends on `mapWithConcurrency`'s worker-pool scheduling and is therefore non-deterministic across runs — never affects the resulting key. Two submissions of "run June payroll for these employees" always resolve to the same `idempotencyKey` regardless of goroutine-style scheduling noise, so the `existingRun` check above is a reliable duplicate-submission guard.

**Corrections never mutate history.** `createCorrection` re-resolves the *exact original ruleset* via `getRuleSetByVersion` (not "whatever's current" via the registry's date-based resolution) — so a correction to a run from months ago is computed with bit-identical rules to the original, then persisted as a brand-new off-cycle `PayrollEntry` linked back via `PayrollCorrection`. The original entry row is never touched.

## 5.3 Payslips — Branded PDF Generation

Payslip PDFs are React components rendered server-side with `@react-pdf/renderer`, which is what makes tenant branding a matter of passing props rather than templating strings:

```typescript
// payslips/payslips.service.ts
async generate(tenantId: string, payrollEntryId: string, actor?: AuthenticatedRequestUser) {
  const entry = await this.prisma.payrollEntry.findUnique({
    where: { id: payrollEntryId },
    include: { employee: { include: { company: true } }, payrollRun: true },
  });
  if (!entry || entry.employee.company.tenantId !== tenantId) throw new NotFoundException('Payroll entry not found');
  // actor is omitted for system-initiated generation (the post-run bulk
  // email job). When present and EMPLOYEE, they may only fetch their own.
  if (actor?.role === Role.EMPLOYEE && actor.employeeId !== entry.employeeId) {
    throw new ForbiddenException('You may only access your own payslip');
  }

  const branding = await this.brandingService.getBranding(tenantId); // logo URL, primary/secondary color, falls back to APP_NAME

  const earnings = entry.earningsBreakdown as EarningsBreakdown;
  const earningLines: PayslipLineItem[] = [
    { label: 'Basic Salary', amount: earnings.basicSalary },
    ...Object.entries(earnings.allowanceBreakdown ?? {}).map(([label, amount]) => ({ label, amount })),
  ];
  if (earnings.overtimeAmount) earningLines.push({ label: 'Overtime', amount: earnings.overtimeAmount });

  const pdfBuffer = await renderToBuffer(
    PayslipDocument({
      branding, companyName: entry.employee.company.name,
      employeeName: `${entry.employee.firstName} ${entry.employee.lastName}`,
      period: entry.payrollRun.period, currency: entry.currency,
      earnings: earningLines,
      statutoryDeductions: (entry.statutoryDeductions as StatutoryLine[]).map((d) => ({ label: d.label, amount: d.employeeAmount })),
      tax: { label: (entry.taxBreakdown as TaxResult).code, amount: (entry.taxBreakdown as TaxResult).netTax },
      grossPay: entry.grossPay, totalDeductions: entry.totalDeductions, netPay: entry.netPay,
    }),
  );

  const pdfPath = join(STORAGE_DIR, `${payrollEntryId}.pdf`);
  await mkdir(STORAGE_DIR, { recursive: true });
  await writeFile(pdfPath, pdfBuffer);
  await this.prisma.payslip.upsert({ where: { payrollEntryId }, create: { payrollEntryId, pdfPath }, update: { pdfPath, generatedAt: new Date() } });

  return pdfBuffer;
}
```

`PayslipDocument` is a `@react-pdf/renderer` component tree (`<Document>` → `<Page>` → `<View>`/`<Text>`) that reads `branding.logoUrl`/`branding.primaryColor` and renders them into the header — the same pattern used for compliance report PDFs in Part 6.

## 5.4 Payroll Calculator & Bank Export

Two smaller modules round out this part:

- **`payroll-calculator` module** exposes a single unauthenticated `POST /payroll-calculator/preview` endpoint that calls `runPayrollCalculation` directly with a client-supplied `countryCode`/`basicSalary`/`allowances`, with no `Employee` or `PayrollRun` persistence at all. This is what powers the public marketing-site "estimate your payroll" calculator (Part 10) — it reuses the exact same engine and rules as real payroll runs, so the public estimate and the real payslip can never drift apart.
- **`bank-export` module** takes a completed `PayrollRun` and produces a bank-specific CSV/text format (account number, amount, reference) employers upload to their bank's bulk-payment portal — one formatter per supported bank format, sharing a common `BankExportRow` interface so adding a new bank format doesn't touch the run-fetching logic.

Part 6 builds the compliance reporting layer on top of the same `PayrollRun`/`PayrollEntry` data these modules already produce.
