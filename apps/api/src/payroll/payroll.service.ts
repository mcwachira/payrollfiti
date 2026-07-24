import { createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Employee, PayrollRunStatus, Prisma } from '@prisma/client';
import {
  PayrollCalculationInput,
  PayrollCalculationResult,
  runPayrollCalculation,
  stableStringify,
  sum,
} from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EmployeesService } from '../employees/employees.service';
import { AuditService } from '../audit/audit.service';
import { RulesCacheService } from './rules-cache.service';
import { RunPayrollDto } from './dto/run-payroll.dto';

interface Computation {
  employee: Employee;
  result: PayrollCalculationResult;
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantsService: TenantsService,
    private readonly employeesService: EmployeesService,
    private readonly rulesCache: RulesCacheService,
    private readonly auditService: AuditService,
  ) {}

  async runPayroll(tenantId: string, actorId: string, dto: RunPayrollDto) {
    const company = await this.tenantsService.assertCompanyBelongsToTenant(
      dto.companyId,
      tenantId,
    );
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    });

    const periodStart = new Date(dto.periodStart);
    const periodEnd = new Date(dto.periodEnd);
    const ruleSet = await this.rulesCache.resolve(
      tenant.countryCode,
      periodStart,
    );

    const employees = await this.prisma.employee.findMany({
      where: { companyId: company.id, status: 'ACTIVE' },
    });

    const computations: Computation[] = [];
    for (const employee of employees) {
      const salaryStructure =
        await this.employeesService.getActiveSalaryStructure(
          employee.id,
          periodStart,
        );
      if (!salaryStructure) continue;

      const input: PayrollCalculationInput = {
        employeeId: employee.id,
        countryCode: ruleSet.countryCode,
        currency: salaryStructure.currency,
        earnings: {
          basicSalary: salaryStructure.basicSalary,
          allowances:
            (salaryStructure.allowances as Record<string, number>) ?? {},
        },
        period: { periodStart: dto.periodStart, periodEnd: dto.periodEnd },
      };

      computations.push({
        employee,
        result: runPayrollCalculation(input, ruleSet),
      });
    }

    const idempotencyKey = this.computeRunIdempotencyKey(
      company.id,
      dto.period,
      ruleSet.version,
      computations,
    );

    const existingRun = await this.prisma.payrollRun.findUnique({
      where: { idempotencyKey },
      include: { entries: true },
    });
    if (existingRun && !dto.force) {
      return existingRun;
    }

    const totals = this.aggregateTotals(computations);

    const run = await this.prisma.$transaction(async (tx) => {
      const payrollRun = await tx.payrollRun.create({
        data: {
          companyId: company.id,
          period: dto.period,
          periodStart,
          periodEnd,
          countryCode: ruleSet.countryCode,
          currency: ruleSet.currency,
          ruleVersion: ruleSet.version,
          status: PayrollRunStatus.COMPLETED,
          idempotencyKey,
          totals: totals as unknown as Prisma.InputJsonValue,
          initiatedById: actorId,
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
      action: 'payroll.run',
      entityType: 'PayrollRun',
      entityId: run.id,
      after: totals as unknown as Prisma.InputJsonValue,
    });

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

  private computeRunIdempotencyKey(
    companyId: string,
    period: string,
    ruleVersion: string,
    computations: Computation[],
  ): string {
    const entryHashes = computations
      .map((c) => `${c.employee.id}:${c.result.inputHash}`)
      .sort();
    return createHash('sha256')
      .update(stableStringify({ companyId, period, ruleVersion, entryHashes }))
      .digest('hex');
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
