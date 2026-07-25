import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      payrollRun: {
        findMany: asyncMock([]),
      },
      payrollEntry: {
        groupBy: asyncMock([]),
        aggregate: asyncMock({ _sum: {}, _count: { _all: 0 } }),
        findMany: asyncMock([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AnalyticsService);
  });

  describe('getPayrollCostBreakdown', () => {
    it('issues exactly one payrollRun.findMany and one payrollEntry.groupBy call regardless of run count', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([
        { id: 'run-1', period: '2026-01' },
        { id: 'run-2', period: '2026-02' },
        { id: 'run-3', period: '2026-03' },
      ]);
      prisma.payrollEntry.groupBy.mockResolvedValue([
        {
          payrollRunId: 'run-1',
          _sum: { grossPay: 1000, totalDeductions: 200, netPay: 800 },
          _count: { _all: 5 },
        },
        {
          payrollRunId: 'run-2',
          _sum: { grossPay: 2000, totalDeductions: 400, netPay: 1600 },
          _count: { _all: 5 },
        },
        {
          payrollRunId: 'run-3',
          _sum: { grossPay: 500, totalDeductions: 100, netPay: 400 },
          _count: { _all: 2 },
        },
      ]);

      const result = await service.getPayrollCostBreakdown(
        'tenant-1',
        'company-1',
      );

      expect(prisma.payrollRun.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.payrollEntry.groupBy).toHaveBeenCalledTimes(1);

      expect(result.byPeriod).toEqual([
        {
          period: '2026-01',
          grossPay: 1000,
          totalDeductions: 200,
          netPay: 800,
          employeeCount: 5,
        },
        {
          period: '2026-02',
          grossPay: 2000,
          totalDeductions: 400,
          netPay: 1600,
          employeeCount: 5,
        },
        {
          period: '2026-03',
          grossPay: 500,
          totalDeductions: 100,
          netPay: 400,
          employeeCount: 2,
        },
      ]);
      expect(result.totals).toEqual({
        grossPay: 3500,
        totalDeductions: 700,
        netPay: 2800,
        employeeCount: 12,
      });
    });

    it('merges multiple runs sharing the same period into a single byPeriod row', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([
        { id: 'run-1', period: '2026-01' },
        { id: 'run-2', period: '2026-01' },
      ]);
      prisma.payrollEntry.groupBy.mockResolvedValue([
        {
          payrollRunId: 'run-1',
          _sum: { grossPay: 1000, totalDeductions: 200, netPay: 800 },
          _count: { _all: 5 },
        },
        {
          payrollRunId: 'run-2',
          _sum: { grossPay: 100, totalDeductions: 20, netPay: 80 },
          _count: { _all: 1 },
        },
      ]);

      const result = await service.getPayrollCostBreakdown(
        'tenant-1',
        'company-1',
      );

      expect(result.byPeriod).toEqual([
        {
          period: '2026-01',
          grossPay: 1100,
          totalDeductions: 220,
          netPay: 880,
          employeeCount: 6,
        },
      ]);
    });

    it('scopes the query to the tenant via company.tenantId rather than throwing for a foreign company', async () => {
      prisma.payrollRun.findMany.mockResolvedValue([]);
      prisma.payrollEntry.groupBy.mockResolvedValue([]);

      const result = await service.getPayrollCostBreakdown(
        'tenant-1',
        'foreign-company',
      );

      expect(prisma.payrollRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'foreign-company',
            company: { tenantId: 'tenant-1' },
          }),
        }),
      );
      expect(result).toEqual({
        byPeriod: [],
        totals: { grossPay: 0, totalDeductions: 0, netPay: 0, employeeCount: 0 },
      });
    });
  });

  describe('getTaxSummary', () => {
    it('issues exactly one aggregate and one findMany call, and reduces byStatutoryCode correctly', async () => {
      prisma.payrollEntry.aggregate.mockResolvedValue({
        _sum: { totalTax: 500, totalStatutoryDeductions: 300, grossPay: 5000 },
        _count: { _all: 3 },
      });
      prisma.payrollEntry.findMany.mockResolvedValue([
        {
          statutoryDeductions: [
            { code: 'NSSF', label: 'NSSF', employeeAmount: 100, employerAmount: 100 },
            { code: 'NHIF', label: 'NHIF', employeeAmount: 50, employerAmount: 0 },
          ],
        },
        {
          statutoryDeductions: [
            { code: 'NSSF', label: 'NSSF', employeeAmount: 100, employerAmount: 100 },
          ],
        },
      ]);

      const result = await service.getTaxSummary('tenant-1', 'company-1');

      expect(prisma.payrollEntry.aggregate).toHaveBeenCalledTimes(1);
      expect(prisma.payrollEntry.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.payrollEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ select: { statutoryDeductions: true } }),
      );

      expect(result.totalTax).toBe(500);
      expect(result.totalStatutoryDeductions).toBe(300);
      expect(result.totalTaxablePayEstimate).toBe(5000);
      expect(result.byStatutoryCode).toEqual({ NSSF: 200, NHIF: 50 });
    });
  });
});
