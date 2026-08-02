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

  const nigeriaCompany = {
    id: 'company-ng',
    tenantId: 'tenant-ng',
    name: 'Acme NG',
    tenant: { countryCode: 'NG' },
  };

  const southAfricaCompany = {
    id: 'company-za',
    tenantId: 'tenant-za',
    name: 'Acme ZA',
    tenant: { countryCode: 'ZA' },
  };

  const nigeriaEmployee = (overrides: Partial<any> = {}) => ({
    id: 'emp-ng-1',
    employeeNumber: 'EMP-NG-001',
    firstName: 'Chidi',
    lastName: 'Okafor',
    taxIdNumber: 'TIN-123',
    pensionNumber: 'RSA-456',
    company: { id: 'company-ng', tenantId: 'tenant-ng', name: 'Acme NG' },
    ...overrides,
  });

  const nigeriaStatutoryDeductions = [
    {
      code: 'PENSION',
      label: 'Pension (PRA 2014)',
      employeeAmount: 6_400,
      employerAmount: 8_000,
    },
    {
      code: 'NHF',
      label: 'National Housing Fund',
      employeeAmount: 1_250,
      employerAmount: 0,
    },
  ];
  const nigeriaTaxBreakdown = {
    code: 'PAYE',
    taxableIncome: 60_000,
    grossTax: 9_000,
    relief: 1_000,
    netTax: 8_000,
  };

  function makeNigeriaEntry(overrides: Partial<any> = {}) {
    return {
      id: 'entry-ng-1',
      currency: 'NGN',
      grossPay: 80_000,
      statutoryDeductions: nigeriaStatutoryDeductions,
      taxBreakdown: nigeriaTaxBreakdown,
      employee: nigeriaEmployee(),
      payrollRun: { period: '2026-01', companyId: 'company-ng' },
      ...overrides,
    };
  }

  const southAfricaEmployee = (overrides: Partial<any> = {}) => ({
    id: 'emp-za-1',
    employeeNumber: 'EMP-ZA-001',
    firstName: 'Thabo',
    lastName: 'Nkosi',
    taxIdNumber: 'ITR-789',
    company: { id: 'company-za', tenantId: 'tenant-za', name: 'Acme ZA' },
    ...overrides,
  });

  const southAfricaStatutoryDeductions = [
    { code: 'UIF', label: 'UIF', employeeAmount: 177.12, employerAmount: 177.12 },
    {
      code: 'SDL',
      label: 'Skills Development Levy',
      employeeAmount: 0,
      employerAmount: 800,
    },
  ];
  const southAfricaTaxBreakdown = {
    code: 'PAYE',
    taxableIncome: 80_000,
    grossTax: 12_000,
    relief: 1_800,
    netTax: 10_200,
  };

  function makeSouthAfricaEntry(overrides: Partial<any> = {}) {
    return {
      id: 'entry-za-1',
      currency: 'ZAR',
      grossPay: 80_000,
      statutoryDeductions: southAfricaStatutoryDeductions,
      taxBreakdown: southAfricaTaxBreakdown,
      employee: southAfricaEmployee(),
      payrollRun: { period: '2026-01', companyId: 'company-za' },
      ...overrides,
    };
  }

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

  describe('Nigeria reports', () => {
    beforeEach(() => {
      prisma.company.findFirst.mockResolvedValue(nigeriaCompany);
    });

    it('generatePayeRemittanceCsv rejects a non-NG tenant', async () => {
      prisma.company.findFirst.mockResolvedValue(kenyaCompany);

      await expect(
        service.generatePayeRemittanceCsv('tenant-1', 'company-1', '2026-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('generatePayeRemittanceCsv emits one row per employee with TIN and PAYE', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [makeNigeriaEntry()],
      });

      const csv = await service.generatePayeRemittanceCsv(
        'tenant-ng',
        'company-ng',
        '2026-01',
      );
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'employee_number,employee_name,tin,taxable_income,paye',
      );
      expect(lines[1]).toContain('TIN-123');
      expect(lines[1]).toContain('8000.00');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('TIN-123');
    });

    it('generatePensionRemittanceCsv sums employee + employer into a total column', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [makeNigeriaEntry()],
      });

      const csv = await service.generatePensionRemittanceCsv(
        'tenant-ng',
        'company-ng',
        '2026-01',
      );
      const lines = csv.split('\n');

      expect(lines[0]).toBe(
        'employee_number,employee_name,rsa_pin,employee_amount,employer_amount,total',
      );
      const cols = lines[1]!.split(',');
      expect(cols[2]).toBe('RSA-456');
      expect(Number(cols[3])).toBeCloseTo(6_400);
      expect(Number(cols[4])).toBeCloseTo(8_000);
      expect(Number(cols[5])).toBeCloseTo(14_400);
    });

    it('generateNhfRemittanceCsv emits the employee-only NHF amount', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [makeNigeriaEntry()],
      });

      const csv = await service.generateNhfRemittanceCsv(
        'tenant-ng',
        'company-ng',
        '2026-01',
      );
      const lines = csv.split('\n');

      expect(lines[0]).toBe('employee_number,employee_name,employee_amount');
      expect(lines[1]).toContain('1250.00');
    });
  });

  describe('South Africa reports', () => {
    beforeEach(() => {
      prisma.company.findFirst.mockResolvedValue(southAfricaCompany);
    });

    it('generateEmp201Csv rejects a non-ZA tenant', async () => {
      prisma.company.findFirst.mockResolvedValue(kenyaCompany);

      await expect(
        service.generateEmp201Csv('tenant-1', 'company-1', '2026-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('generateEmp201Csv aggregates PAYE, UIF (both sides), and SDL into one row', async () => {
      prisma.payrollRun.findFirst.mockResolvedValue({
        period: '2026-01',
        entries: [makeSouthAfricaEntry(), makeSouthAfricaEntry({ id: 'entry-za-2' })],
      });

      const csv = await service.generateEmp201Csv(
        'tenant-za',
        'company-za',
        '2026-01',
      );
      const [header, row] = csv.split('\n');

      expect(header).toBe(
        'period,employee_count,total_paye,total_uif_employee,total_uif_employer,total_sdl',
      );
      const cols = row!.split(',');
      expect(cols[1]).toBe('2');
      expect(Number(cols[2])).toBeCloseTo(10_200 * 2);
      expect(Number(cols[3])).toBeCloseTo(177.12 * 2);
      expect(Number(cols[4])).toBeCloseTo(177.12 * 2);
      expect(Number(cols[5])).toBeCloseTo(800 * 2);
    });

    it('generateIrp5 renders a PDF using the employee tax ID reference number', async () => {
      prisma.payrollEntry.findMany.mockResolvedValue([makeSouthAfricaEntry()]);

      const buffer = await service.generateIrp5(
        'tenant-za',
        'company-za',
        'emp-za-1',
        '2026',
      );

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
      expect(encryptionService.decrypt).toHaveBeenCalledWith('ITR-789');
    });

    it('generateIrp5 throws NotFoundException when no entries exist for the year', async () => {
      prisma.payrollEntry.findMany.mockResolvedValue([]);

      await expect(
        service.generateIrp5('tenant-za', 'company-za', 'emp-za-1', '2026'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
