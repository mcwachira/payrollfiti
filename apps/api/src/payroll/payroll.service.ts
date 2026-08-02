import { createHash, randomUUID } from 'crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Employee,
  PayrollCorrection,
  PayrollRunStatus,
  Prisma,
  Role,
} from '@prisma/client';
import {
  PayrollCalculationInput,
  PayrollCalculationResult,
  getRuleSetByVersion,
  runPayrollCalculation,
  stableStringify,
  sum,
} from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EmployeesService } from '../employees/employees.service';
import { AuditService } from '../audit/audit.service';
import { SalaryComponentsService } from '../salary-components/salary-components.service';
import { PayslipEmailService } from '../notifications/payslip-email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { LoansService, DueLoanRepayment } from '../loans/loans.service';
import { RulesCacheService } from './rules-cache.service';
import { RunPayrollDto } from './dto/run-payroll.dto';
import { RunOffCyclePayrollDto } from './dto/run-off-cycle-payroll.dto';
import { CreateCorrectionDto } from './dto/create-correction.dto';

interface Computation {
  employee: Employee;
  result: PayrollCalculationResult;
  loanRepayments: DueLoanRepayment[];
}

interface ExecuteRunParams {
  tenantId: string;
  actorId: string;
  companyId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  employeeIds?: string[];
  isOffCycle: boolean;
  reason?: string;
  force?: boolean;
}

// Bounded above a plain Promise.all so a large payroll run (hundreds/
// thousands of employees) doesn't fire that many concurrent DB queries at
// once and exhaust the connection pool. Each employee's per-run data
// gathering (salary structure, salary components, loan deductions) is
// independent of every other employee's, and both downstream consumers of
// the resulting array — computeRunIdempotencyKey (sorts entry hashes
// before hashing) and aggregateTotals (a commutative sum) — are already
// order-independent, so parallelizing this is safe.
const RUN_COMPUTATION_CONCURRENCY = 10;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly employeesService: EmployeesService,
    private readonly rulesCache: RulesCacheService,
    private readonly auditService: AuditService,
    private readonly salaryComponentsService: SalaryComponentsService,
    private readonly payslipEmailService: PayslipEmailService,
    private readonly notificationsService: NotificationsService,
    private readonly webhooksService: WebhooksService,
    private readonly loansService: LoansService,
  ) {}

  async runPayroll(tenantId: string, actorId: string, dto: RunPayrollDto) {
    return this.executeRun({
      tenantId,
      actorId,
      companyId: dto.companyId,
      period: dto.period,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      isOffCycle: false,
      force: dto.force,
    });
  }

  async runOffCyclePayroll(
    tenantId: string,
    actorId: string,
    dto: RunOffCyclePayrollDto,
  ) {
    return this.executeRun({
      tenantId,
      actorId,
      companyId: dto.companyId,
      period: dto.period,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      employeeIds: dto.employeeIds,
      isOffCycle: true,
      reason: dto.reason,
    });
  }

  /**
   * Shared body for both the ordinary monthly run and off-cycle runs. Only
   * the parameters differ — company/tenant/ruleSet resolution, per-employee
   * computation, idempotency, persistence and auditing are identical either
   * way.
   */
  private async executeRun(params: ExecuteRunParams) {
    const {
      tenantId,
      actorId,
      companyId,
      period,
      periodStart: periodStartInput,
      periodEnd: periodEndInput,
      employeeIds,
      isOffCycle,
      reason,
      force,
    } = params;

    const company = await this.tenantsService.assertCompanyBelongsToTenant(
      companyId,
      tenantId,
    );
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    const periodStart = new Date(periodStartInput);
    const periodEnd = new Date(periodEndInput);
    const ruleSet = await this.rulesCache.resolve(
      tenant.countryCode,
      periodStart,
    );

    const employees = await this.prisma.employee.findMany({
      where: {
        companyId: company.id,
        status: 'ACTIVE',
        ...(employeeIds ? { id: { in: employeeIds } } : {}),
      },
    });

    const perEmployeeResults = await mapWithConcurrency(
      employees,
      RUN_COMPUTATION_CONCURRENCY,
      async (employee): Promise<Computation | null> => {
        const salaryStructure =
          await this.employeesService.getActiveSalaryStructure(
            employee.id,
            periodStart,
          );
        if (!salaryStructure) return null;

        const { allowances, voluntaryDeductions: componentDeductions } =
          await this.salaryComponentsService.resolveStructureEarnings(
            salaryStructure.id,
            salaryStructure.basicSalary,
            salaryStructure.allowances as Record<string, number> | null,
          );
        const {
          voluntaryDeductions: loanDeductions,
          repayments: loanRepayments,
        } = await this.loansService.resolvePayrollDeductions(
          tenantId,
          employee.id,
          period,
        );
        const voluntaryDeductions = {
          ...componentDeductions,
          ...loanDeductions,
        };

        // Only set `deductions` when there's something in it — omitting the
        // key entirely (rather than setting it to `{ voluntary: {} }`) keeps
        // the stableStringify shape of the input, and therefore its
        // inputHash/idempotencyKey, byte-identical to before this field
        // existed for every structure with no voluntary deduction lines,
        // which today is all of them.
        const input: PayrollCalculationInput = {
          employeeId: employee.id,
          countryCode: ruleSet.countryCode,
          currency: salaryStructure.currency,
          earnings: {
            basicSalary: salaryStructure.basicSalary,
            allowances,
          },
          ...(Object.keys(voluntaryDeductions).length > 0
            ? { deductions: { voluntary: voluntaryDeductions } }
            : {}),
          period: { periodStart: periodStartInput, periodEnd: periodEndInput },
        };

        return {
          employee,
          result: runPayrollCalculation(input, ruleSet),
          loanRepayments,
        };
      },
    );
    const computations: Computation[] = perEmployeeResults.filter(
      (c): c is Computation => c !== null,
    );

    // Currency is single-currency-per-tenant: every employee in a run must
    // be paid in the run's country's currency (ruleSet.currency) — there is
    // no cross-currency conversion anywhere in the system (see the
    // single-currency-per-tenant note on Employee.currency in schema.prisma).
    // Each country ruleset's validate() already flags a currency mismatch as
    // a 'error'-severity ValidationIssue (e.g. "Kenya payroll must be run in
    // KES"), but nothing previously read `result.validation` — a
    // misconfigured SalaryStructure.currency would silently corrupt this
    // run's aggregate totals (aggregateTotals sums netPay/grossPay/
    // totalDeductions numerically with no currency check). Fail the whole
    // run rather than silently excluding the mismatched employee, since a
    // wrong currency on a salary structure is a data error that needs
    // fixing, not routine payroll behavior.
    const currencyErrors = computations
      .flatMap(({ employee, result }) =>
        result.validation
          .filter(
            (issue) => issue.severity === 'error' && issue.field === 'currency',
          )
          .map((issue) => ({ employee, issue })),
      );
    if (currencyErrors.length > 0) {
      const details = currencyErrors
        .map(
          ({ employee, issue }) =>
            `${employee.firstName} ${employee.lastName} (${employee.id}): ${issue.message}`,
        )
        .join('; ');
      throw new BadRequestException(
        `Cannot run payroll — currency mismatch for ${currencyErrors.length} employee(s): ${details}`,
      );
    }

    const idempotencyKey = this.computeRunIdempotencyKey(
      company.id,
      period,
      ruleSet.version,
      computations,
      isOffCycle,
      reason,
    );

    const existingRun = await this.prisma.payrollRun.findUnique({
      where: { idempotencyKey },
      include: { entries: true },
    });
    if (existingRun && !force) {
      return existingRun;
    }

    const totals = this.aggregateTotals(computations);

    const run = await this.prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          companyId: company.id,
          period,
          periodStart,
          periodEnd,
          countryCode: ruleSet.countryCode,
          currency: ruleSet.currency,
          ruleVersion: ruleSet.version,
          status: PayrollRunStatus.COMPLETED,
          idempotencyKey,
          totals: totals as unknown as Prisma.InputJsonValue,
          initiatedById: actorId,
          isOffCycle,
          reason,
        },
      });

      for (const { employee, result } of computations) {
        const totalStatutoryDeductions = sum(
          result.statutoryDeductions.map((d) => d.employeeAmount),
        );
        await tx.payrollEntry.create({
          data: {
            payrollRunId: payrollRun.id,
            employeeId: employee.id,
            currency: result.currency,
            prorationFactor: result.prorationFactor,
            grossPay: result.grossPay,
            totalTax: result.tax.netTax,
            totalStatutoryDeductions,
            totalVoluntaryDeductions: result.totalVoluntaryDeductions,
            totalDeductions: result.totalDeductions,
            netPay: result.netPay,
            earningsBreakdown:
              result.earnings as unknown as Prisma.InputJsonValue,
            statutoryDeductions:
              result.statutoryDeductions as unknown as Prisma.InputJsonValue,
            taxBreakdown: result.tax as unknown as Prisma.InputJsonValue,
            inputHash: result.inputHash,
          },
        });
      }

      return tx.payrollRun.findUniqueOrThrow({
        where: { id: payrollRun.id },
        include: { entries: true },
      });
    });

    await this.auditService.record({
      tenantId,
      actorId,
      action: isOffCycle ? 'payroll.run.off-cycle' : 'payroll.run',
      entityType: 'PayrollRun',
      entityId: run.id,
      after: totals as unknown as Prisma.InputJsonValue,
    });

    // Enqueued rather than run inline — rendering + emailing a payslip per
    // employee would otherwise add request latency proportional to
    // headcount. PayslipEmailsProcessor (BullMQ) picks this up off the
    // request thread; sendPayslipEmailsForRun itself never throws.
    await this.payslipEmailService.enqueueForRun(tenantId, run.id);

    // Marks the loan installments folded into this run's voluntaryDeductions
    // (see resolvePayrollDeductions above) as paid — never throws (see
    // LoansService.markRepaymentsPaid), for the same reason as the payslip
    // email above.
    for (const entry of run.entries) {
      const computation = computations.find(
        (c) => c.employee.id === entry.employeeId,
      );
      if (computation && computation.loanRepayments.length > 0) {
        await this.loansService.markRepaymentsPaid(
          computation.loanRepayments,
          entry.id,
        );
      }
    }

    // Best-effort notification for a run that has already been committed —
    // dispatchForRoles never throws (see NotificationsService).
    await this.notificationsService.dispatchForRoles(
      tenantId,
      [Role.ADMIN, Role.HR],
      'PAYROLL_RUN_COMPLETED',
      `Payroll run for ${run.period} has completed. Net pay total: ${totals.netPay} ${run.currency}.`,
      {
        metadata: {
          runId: run.id,
          companyId: run.companyId,
          period: run.period,
        },
      },
    );

    // Best-effort webhook dispatch for a run that has already been
    // committed — a delivery failure must never fail the HTTP response.
    void this.webhooksService
      .dispatch(tenantId, 'payroll.run.completed', {
        runId: run.id,
        companyId: run.companyId,
        period: run.period,
        totals: run.totals,
      })
      .catch(() => {});

    return run;
  }

  async findOne(tenantId: string, runId: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        entries: { include: { employee: true, payslip: true } },
        company: true,
      },
    });
    if (!run || run.company.tenantId !== tenantId) {
      throw new NotFoundException('Payroll run not found');
    }
    return run;
  }

  async findAll(tenantId: string, companyId: string) {
    await this.tenantsService.assertCompanyBelongsToTenant(companyId, tenantId);
    return this.prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Read-only payslip history for the current user's own employee record — no admin/HR role required */
  async findMine(tenantId: string, employeeId: string | null) {
    if (!employeeId) return [];
    return this.prisma.payrollEntry.findMany({
      where: { employeeId, employee: { company: { tenantId } } },
      include: { payrollRun: true },
      orderBy: { payrollRun: { periodStart: 'desc' } },
    });
  }

  /**
   * Recomputes a single already-completed payroll entry against the exact
   * ruleset that produced it, and records the corrected figures as a new
   * off-cycle entry linked back to the original via PayrollCorrection. The
   * original entry is never mutated — this keeps a full audit trail of what
   * was actually paid and why it changed.
   */
  async createCorrection(
    tenantId: string,
    actorId: string,
    originalEntryId: string,
    dto: CreateCorrectionDto,
  ) {
    const originalEntry = await this.prisma.payrollEntry.findUnique({
      where: { id: originalEntryId },
      include: {
        employee: { include: { company: true } },
        payrollRun: true,
      },
    });
    if (
      !originalEntry ||
      originalEntry.employee.company.tenantId !== tenantId
    ) {
      throw new NotFoundException('Payroll entry not found');
    }
    if (originalEntry.payrollRun.status !== PayrollRunStatus.COMPLETED) {
      throw new BadRequestException('Only completed runs can be corrected');
    }

    // Resolve the exact original ruleset (not the rules cache) to guarantee
    // bit-identical rules to the original run.
    const originalRuleSet = getRuleSetByVersion(
      originalEntry.payrollRun.countryCode,
      originalEntry.payrollRun.ruleVersion,
    );

    const input: PayrollCalculationInput = {
      employeeId: originalEntry.employeeId,
      countryCode: originalEntry.payrollRun.countryCode,
      currency: originalEntry.payrollRun.currency,
      earnings: {
        basicSalary: dto.basicSalary,
        allowances: dto.allowances ?? {},
        overtimeAmount: dto.overtimeAmount,
        commissionAmount: dto.commissionAmount,
        bonusAmount: dto.bonusAmount,
      },
      period: {
        periodStart: originalEntry.payrollRun.periodStart.toISOString(),
        periodEnd: originalEntry.payrollRun.periodEnd.toISOString(),
      },
    };
    const result = runPayrollCalculation(input, originalRuleSet);

    const correction = await this.prisma.$transaction(async (tx) => {
      const correctionRun = await tx.payrollRun.create({
        data: {
          companyId: originalEntry.payrollRun.companyId,
          period: originalEntry.payrollRun.period,
          periodStart: originalEntry.payrollRun.periodStart,
          periodEnd: originalEntry.payrollRun.periodEnd,
          countryCode: originalEntry.payrollRun.countryCode,
          currency: originalEntry.payrollRun.currency,
          ruleVersion: originalEntry.payrollRun.ruleVersion,
          status: PayrollRunStatus.COMPLETED,
          idempotencyKey: randomUUID(),
          initiatedById: actorId,
          isOffCycle: true,
          reason: dto.reason,
        },
      });

      const totalStatutoryDeductions = sum(
        result.statutoryDeductions.map((d) => d.employeeAmount),
      );
      const correctedEntry = await tx.payrollEntry.create({
        data: {
          payrollRunId: correctionRun.id,
          employeeId: originalEntry.employeeId,
          currency: result.currency,
          prorationFactor: result.prorationFactor,
          grossPay: result.grossPay,
          totalTax: result.tax.netTax,
          totalStatutoryDeductions,
          totalVoluntaryDeductions: result.totalVoluntaryDeductions,
          totalDeductions: result.totalDeductions,
          netPay: result.netPay,
          earningsBreakdown:
            result.earnings as unknown as Prisma.InputJsonValue,
          statutoryDeductions:
            result.statutoryDeductions as unknown as Prisma.InputJsonValue,
          taxBreakdown: result.tax as unknown as Prisma.InputJsonValue,
          inputHash: result.inputHash,
        },
      });

      const payrollCorrection = await tx.payrollCorrection.create({
        data: {
          originalEntryId: originalEntry.id,
          correctedEntryId: correctedEntry.id,
          reason: dto.reason,
          createdById: actorId,
        },
      });

      return { ...payrollCorrection, correctedEntry };
    });

    await this.auditService.record({
      tenantId,
      actorId,
      action: 'payroll.correction',
      entityType: 'PayrollEntry',
      entityId: originalEntryId,
      after: {
        correctionId: correction.id,
        correctedEntryId: correction.correctedEntryId,
        netPay: result.netPay,
        reason: dto.reason,
      } as unknown as Prisma.InputJsonValue,
    });

    return correction;
  }

  async listCorrections(
    tenantId: string,
    originalEntryId: string,
  ): Promise<PayrollCorrection[]> {
    const originalEntry = await this.prisma.payrollEntry.findUnique({
      where: { id: originalEntryId },
      include: { employee: { include: { company: true } } },
    });
    if (
      !originalEntry ||
      originalEntry.employee.company.tenantId !== tenantId
    ) {
      throw new NotFoundException('Payroll entry not found');
    }

    return this.prisma.payrollCorrection.findMany({
      where: { originalEntryId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * CRITICAL: hashes the same payload shape as before this method existed
   * for ordinary (non-off-cycle) runs — isOffCycle/reason are only mixed
   * into the payload when isOffCycle is true. Changing this for ordinary
   * runs would silently break idempotency for every already-COMPLETED
   * period in any real deployment.
   */
  private computeRunIdempotencyKey(
    companyId: string,
    period: string,
    ruleVersion: string,
    computations: Computation[],
    isOffCycle: boolean,
    reason?: string,
  ): string {
    const entryHashes = computations
      .map((c) => `${c.employee.id}:${c.result.inputHash}`)
      .sort();
    const payload: Record<string, unknown> = {
      companyId,
      period,
      ruleVersion,
      entryHashes,
    };
    if (isOffCycle) {
      payload.isOffCycle = true;
      payload.reason = reason;
    }
    return createHash('sha256').update(stableStringify(payload)).digest('hex');
  }

  private aggregateTotals(computations: Computation[]) {
    return {
      employeeCount: computations.length,
      grossPay: sum(computations.map((c) => c.result.grossPay)),
      totalDeductions: sum(computations.map((c) => c.result.totalDeductions)),
      netPay: sum(computations.map((c) => c.result.netPay)),
    };
  }
}
