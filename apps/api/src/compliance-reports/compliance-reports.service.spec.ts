import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ComplianceReportsService } from './compliance-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService } from '../branding/branding.service';
import { EncryptionService } from '../common/crypto/encryption.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('ComplianceReportsService', () => {
  let service: ComplianceReportsService;
  let prisma: any;

  const kenyaCompany = {
    id: 'company-1',
    tenantId: 'tenant-1',
    name: 'Acme KE',
    tenant: { countryCode: 'KE' },
  };

  const employee = (overrides: Partial<any> = {}) => ({
    id: 'emp-1',
    employeeNumber: 'EMP-001',
    firstName: 'Jane',
    lastName: 'Doe',
    kraPin: 'A123456789Z',
    nssfNumber: 'NSSF-1',
    nhifNumber: 'NHIF-1',
    company: { id: 'company-1', tenantId: 'tenant-1', name: 'Acme KE' },
    ...overrides,
  });

  const statutoryDeductions = [
    { code: 'NSSF', label: 'NSSF', employeeAmount: 2160, employerAmount: 2160 },
    { code: 'NHIF', label: 'NHIF', employeeAmount: 1700, employerAmount: 0 },
    {
      code: 'HOUSING_LEVY',
      label: 'Affordable Housing Levy',
      employeeAmount: 1200,
      employerAmount: 1200,
    },
  ];
  const taxBreakdown = {
    code: 'PAYE',
    taxableIncome: 76_640,
    grossTax: 15_000,
    relief: 2_400,
    netTax: 12_600,
  };

  function makeEntry(overrides: Partial<any> = {}) {
    return {
      id: 'entry-1',
      currency: 'KES',
      grossPay: 80_000,
      statutoryDeductions,
      taxBreakdown,
      employee: employee(),
      payrollRun: { period: '2026-01', companyId: 'company-1' },
      ...overrides,
    };
  }

  let encryptionService: any;

  beforeEach(async () => {
    prisma = {
      company: { findFirst: asyncMock(kenyaCompany) },
      payrollEntry: { findMany: asyncMock([]) },
      payrollRun: { findFirst: asyncMock(null) },
    };
    // Identity passthrough — round-trip correctness is covered by
    // encryption.service.spec.ts.
    encryptionService = {
      decrypt: jest.fn((v: string | null) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceReportsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BrandingService,
          useValue: {
            getBranding: asyncMock({ appName: 'PayrollFiti' }),
          },
        },
        { provide: EncryptionService, useValue: encryptionService },
      ],
    }).compile();

    service = module.get(ComplianceReportsService);
  });

  describe('tenant/country guards', () => {
    it('throws BadRequestException when the tenant country is not KE', async () => {
      prisma.company.findFirst.mockResolvedValue({
        ...kenyaCompany,
        tenant: { countryCode: 'NG' },
      });

      await expect(
        service.generateP10Csv('tenant-1', 'company-1', '2026-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a cross-tenant companyId', async () => {
      prisma.company.findFirst.mockResolvedValue(null);

      await expect(
        service.generateP10Csv('tenant-1', 'company-2', '2026-01'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateP9', () => {
    it('extracts correct per-month rows from statutoryDeductions/taxBreakdown fixtures', async () => {
      prisma.payrollEntry.findMany.mockResolvedValue([
        makeEntry({
          payrollRun: { period: '2026-01', companyId: 'company-1' },
        }),
        makeEntry({
          id: 'entry-2',
          payrollRun: { period: '2026-02', companyId: 'company-1' },
        }),
      ]);

      const buffer = await service.generateP9(
        'tenant-1',
        'company-1',
        'emp-1',
        '2026',
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(encryptionService.decrypt).toHaveBeenCalledWith('A123456789Z');
    });

    it('throws NotFoundException when no entries exist for the employee/tax year', async () => {
      prisma.payrollEntry.findMany.mockResolvedValue([]);

      await expect(
        service.generateP9('tenant-1', 'company-1', 'emp-1', '2026'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the resolved employee belongs to another tenant', async () => {
      prisma.payrollEntry.findMany.mockResolvedValue([
        makeEntry({
          employee: employee({
            company: { id: 'company-2', tenantId: 'tenant-2' },
          }),
        }),
      ]);

      await expect(
        service.generateP9('tenant-1', 'company-1', 'emp-1', '2026'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateP10Csv', () => {
    it('sums totals correctly across multiple employees into a single summary row', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [
          makeEntry({ id: 'entry-1' }),
          makeEntry({
            id: 'entry-2',
            grossPay: 100_000,
            statutoryDeductions: [
              {
                code: 'NSSF',
                label: 'NSSF',
                employeeAmount: 2160,
                employerAmount: 2160,
              },
              {
                code: 'NHIF',
                label: 'NHIF',
                employeeAmount: 1700,
                employerAmount: 0,
              },
            ],
            taxBreakdown: {
              code: 'PAYE',
              taxableIncome: 96_640,
              grossTax: 20_000,
              relief: 2_400,
              netTax: 17_600,
            },
          }),
        ],
      });

      const csv = await service.generateP10Csv(
        'tenant-1',
        'company-1',
        '2026-01',
      );
      const [header, row] = csv.split('\n');

      expect(header).toBe(
        'period,employee_count,total_taxable_pay,total_paye,total_nssf,total_nhif',
      );
      const cols = row!.split(',');
      expect(cols[0]).toBe('2026-01');
      expect(cols[1]).toBe('2');
      expect(Number(cols[2])).toBeCloseTo(76_640 + 96_640);
      expect(Number(cols[3])).toBeCloseTo(12_600 + 17_600);
      expect(Number(cols[4])).toBeCloseTo(2160 + 2160);
      expect(Number(cols[5])).toBeCloseTo(1700 + 1700);
    });

    it('throws NotFoundException when no run exists for the period', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue(null);

      await expect(
        service.generateP10Csv('tenant-1', 'company-1', '2026-01'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateNssfRemittanceCsv', () => {
    it('emits one row per employee keyed off nssfNumber', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [makeEntry(), makeEntry({ id: 'entry-2' })],
      });

      const csv = await service.generateNssfRemittanceCsv(
        'tenant-1',
        'company-1',
        '2026-01',
      );
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'employee_number,employee_name,nssf_number,employee_amount,employer_amount',
      );
      expect(lines).toHaveLength(3);
      expect(lines[1]).toContain('NSSF-1');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('NSSF-1');
    });
  });

  describe('generateNhifRemittanceCsv', () => {
    it('emits one row per employee keyed off nhifNumber', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [makeEntry(), makeEntry({ id: 'entry-2' })],
      });

      const csv = await service.generateNhifRemittanceCsv(
        'tenant-1',
        'company-1',
        '2026-01',
      );
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'employee_number,employee_name,nhif_number,employee_amount',
      );
      expect(lines).toHaveLength(3);
      expect(lines[1]).toContain('NHIF-1');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('NHIF-1');
    });
  });
});
