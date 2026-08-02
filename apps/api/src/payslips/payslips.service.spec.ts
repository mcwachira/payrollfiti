import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { renderToBuffer } from '@react-pdf/renderer';
import { mkdir, writeFile } from 'node:fs/promises';
import { PayslipsService } from './payslips.service';
import { PrismaService } from '../prisma/prisma.service';
import { BrandingService } from '../branding/branding.service';

jest.mock('@react-pdf/renderer', () => ({
  renderToBuffer: jest.fn(),
  // payslip.template.tsx renders these as JSX; stub them as no-op components
  // and an identity StyleSheet so requiring the template doesn't blow up.
  Document: 'Document',
  Page: 'Page',
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('node:fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
}));

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('PayslipsService', () => {
  let service: PayslipsService;
  let prisma: any;
  let brandingService: any;
  const fixtureBuffer = Buffer.from('fake-pdf');

  const entry = {
    id: 'entry-1',
    employeeId: 'emp-1',
    currency: 'KES',
    grossPay: 85000,
    totalDeductions: 15000,
    netPay: 70000,
    earningsBreakdown: {
      basicSalary: 80000,
      allowanceBreakdown: { transport: 5000 },
      overtimeAmount: 0,
      commissionAmount: 0,
      bonusAmount: 0,
    },
    statutoryDeductions: [{ label: 'PAYE', employeeAmount: 10000 }],
    taxBreakdown: { code: 'PAYE', netTax: 10000 },
    employee: {
      firstName: 'Jane',
      lastName: 'Doe',
      employeeNumber: 'EMP001',
      company: { tenantId: 'tenant-1', name: 'Acme' },
    },
    payrollRun: { period: '2026-07' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    prisma = {
      payrollEntry: { findUnique: asyncMock(entry) },
      payslip: { upsert: asyncMock({ payrollEntryId: 'entry-1' }) },
    };
    brandingService = { getBranding: asyncMock({ appName: 'PayrollFiti' }) };

    (renderToBuffer as jest.Mock).mockResolvedValue(fixtureBuffer as never);
    (mkdir as jest.Mock).mockResolvedValue(undefined as never);
    (writeFile as jest.Mock).mockResolvedValue(undefined as never);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayslipsService,
        { provide: PrismaService, useValue: prisma },
        { provide: BrandingService, useValue: brandingService },
      ],
    }).compile();

    service = module.get(PayslipsService);
  });

  it('renders, persists, and returns the payslip PDF', async () => {
    const result = await service.generate('tenant-1', 'entry-1');

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    expect(mkdir).toHaveBeenCalledTimes(1);
    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining('entry-1.pdf'),
      fixtureBuffer,
    );
    expect(prisma.payslip.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { payrollEntryId: 'entry-1' },
        create: expect.objectContaining({ payrollEntryId: 'entry-1' }),
      }),
    );
    expect(result).toBe(fixtureBuffer);
  });

  it('throws NotFoundException and never renders when the entry does not exist', async () => {
    prisma.payrollEntry.findUnique.mockResolvedValueOnce(null);

    await expect(service.generate('tenant-1', 'missing-entry')).rejects.toThrow(
      NotFoundException,
    );
    expect(renderToBuffer).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('throws NotFoundException and never renders for a cross-tenant entry', async () => {
    prisma.payrollEntry.findUnique.mockResolvedValueOnce({
      ...entry,
      employee: {
        ...entry.employee,
        company: { tenantId: 'other-tenant', name: 'Acme' },
      },
    });

    await expect(service.generate('tenant-1', 'entry-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(renderToBuffer).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  describe('ownership check', () => {
    it('allows an EMPLOYEE actor to generate their own payslip', async () => {
      const result = await service.generate('tenant-1', 'entry-1', {
        role: Role.EMPLOYEE,
        employeeId: 'emp-1',
      } as any);

      expect(result).toBe(fixtureBuffer);
    });

    it('rejects an EMPLOYEE actor generating a co-worker\'s payslip', async () => {
      await expect(
        service.generate('tenant-1', 'entry-1', {
          role: Role.EMPLOYEE,
          employeeId: 'someone-else',
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(renderToBuffer).not.toHaveBeenCalled();
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('allows ADMIN/HR actors to generate any payslip in their tenant', async () => {
      const result = await service.generate('tenant-1', 'entry-1', {
        role: Role.ADMIN,
        employeeId: 'someone-else',
      } as any);

      expect(result).toBe(fixtureBuffer);
    });

    it('allows system-initiated generation with no actor at all', async () => {
      const result = await service.generate('tenant-1', 'entry-1');

      expect(result).toBe(fixtureBuffer);
    });
  });
});
