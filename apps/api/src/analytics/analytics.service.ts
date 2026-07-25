import { Injectable } from '@nestjs/common';
import { round2, StatutoryDeductionLine } from '@repo/payroll-rules';
import { PrismaService } from '../prisma/prisma.service';

export interface PayrollCostBreakdown {
  byPeriod: {
    period: string;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    employeeCount: number;
  }[];
  totals: {
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    employeeCount: number;
  };
}

export interface TaxSummary {
  totalTaxablePayEstimate: number;
  totalTax: number;
  totalStatutoryDeductions: number;
  byStatutoryCode: Record<string, number>;
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Efficiency requirement: this is exactly TWO queries no matter how many
   * payroll runs/employees exist in the period — one to resolve the
   * tenant-scoped run ids + their periods, one aggregate `groupBy` over
   * their entries. No per-run or per-employee loop touches the DB.
   */
  async getPayrollCostBreakdown(
    tenantId: string,
    companyId: string,
    periodFrom?: string,
    periodTo?: string,
  ): Promise<PayrollCostBreakdown> {
    const runs = await this.prisma.payrollRun.findMany({
      where: {
        companyId,
        company: { tenantId },
        ...(periodFrom || periodTo
          ? { period: { gte: periodFrom, lte: periodTo } }
          : {}),
      },
      select: { id: true, period: true },
    });

    const sums = await this.prisma.payrollEntry.groupBy({
      by: ['payrollRunId'],
      where: { payrollRunId: { in: runs.map((r) => r.id) } },
      _sum: { grossPay: true, totalDeductions: true, netPay: true },
      _count: { _all: true },
    });

    const sumsByRunId = new Map(sums.map((s) => [s.payrollRunId, s]));

    // Multiple runs (e.g. an ordinary run plus an off-cycle correction run)
    // can share the same `period` — merge them into one row per period in
    // application code rather than the DB.
    const byPeriodMap = new Map<
      string,
      {
        period: string;
        grossPay: number;
        totalDeductions: number;
        netPay: number;
        employeeCount: number;
      }
    >();

    for (const run of runs) {
      const s = sumsByRunId.get(run.id);
      const grossPay = s?._sum.grossPay ?? 0;
      const totalDeductions = s?._sum.totalDeductions ?? 0;
      const netPay = s?._sum.netPay ?? 0;
      const employeeCount = s?._count._all ?? 0;

      const existing = byPeriodMap.get(run.period);
      if (existing) {
        existing.grossPay += grossPay;
        existing.totalDeductions += totalDeductions;
        existing.netPay += netPay;
        existing.employeeCount += employeeCount;
      } else {
        byPeriodMap.set(run.period, {
          period: run.period,
          grossPay,
          totalDeductions,
          netPay,
          employeeCount,
        });
      }
    }

    const byPeriod = Array.from(byPeriodMap.values())
      .map((p) => ({
        ...p,
        grossPay: round2(p.grossPay),
        totalDeductions: round2(p.totalDeductions),
        netPay: round2(p.netPay),
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    const totals = byPeriod.reduce(
      (acc, p) => ({
        grossPay: round2(acc.grossPay + p.grossPay),
        totalDeductions: round2(acc.totalDeductions + p.totalDeductions),
        netPay: round2(acc.netPay + p.netPay),
        employeeCount: acc.employeeCount + p.employeeCount,
      }),
      { grossPay: 0, totalDeductions: 0, netPay: 0, employeeCount: 0 },
    );

    return { byPeriod, totals };
  }

  /**
   * Efficiency requirement: exactly TWO queries regardless of entry count —
   * one true DB-level `aggregate` for the scalar totals, and one `findMany`
   * that selects ONLY the `statutoryDeductions` JSON column (no relations,
   * no other columns) for the per-code breakdown.
   */
  async getTaxSummary(
    tenantId: string,
    companyId: string,
    periodFrom?: string,
    periodTo?: string,
  ): Promise<TaxSummary> {
    const where = {
      payrollRun: {
        companyId,
        company: { tenantId },
        ...(periodFrom || periodTo
          ? { period: { gte: periodFrom, lte: periodTo } }
          : {}),
      },
    };

    const aggregate = await this.prisma.payrollEntry.aggregate({
      where,
      // grossPay is summed here too (as a taxable-pay *estimate* — hence
      // the field name — rather than a precise post-relief figure) since
      // it's a free addition to the same single aggregate call, not an
      // extra query.
      _sum: { totalTax: true, totalStatutoryDeductions: true, grossPay: true },
      _count: { _all: true },
    });

    const entries = await this.prisma.payrollEntry.findMany({
      where,
      select: { statutoryDeductions: true },
    });

    // O(entries-in-period) in-app reduce, backed by the single findMany
    // query above — NOT an N+1 (there is exactly one DB round trip here
    // regardless of how many entries exist). Postgres can't groupBy/_sum
    // inside a JSON array portably without raw SQL; a raw
    // `jsonb_array_elements` query is the documented follow-up if this
    // becomes a hot path at scale.
    const byStatutoryCode: Record<string, number> = {};
    for (const entry of entries) {
      const lines = (entry.statutoryDeductions ??
        []) as unknown as StatutoryDeductionLine[];
      for (const line of lines) {
        byStatutoryCode[line.code] = round2(
          (byStatutoryCode[line.code] ?? 0) + line.employeeAmount,
        );
      }
    }

    return {
      totalTaxablePayEstimate: round2(aggregate._sum.grossPay ?? 0),
      totalTax: round2(aggregate._sum.totalTax ?? 0),
      totalStatutoryDeductions: round2(
        aggregate._sum.totalStatutoryDeductions ?? 0,
      ),
      byStatutoryCode,
    };
  }
}
