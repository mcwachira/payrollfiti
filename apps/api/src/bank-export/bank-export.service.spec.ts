import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BankExportService } from './bank-export.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('BankExportService', () => {
  let service: BankExportService;
  let prisma: any;
  let encryptionService: any;

  beforeEach(async () => {
    prisma = { payrollRun: { findUnique: asyncMock(null) } };
    // Identity passthrough — round-trip correctness is covered by
    // encryption.service.spec.ts; here we just need decrypt to be a no-op
    // so existing fixtures (plaintext values) still assert correctly, plus
    // one test that the call actually happens.
    encryptionService = {
      decrypt: jest.fn((v: string | null) => v),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankExportService,
        { provide: PrismaService, useValue: prisma },
        { provide: EncryptionService, useValue: encryptionService },
      ],
    }).compile();

    service = module.get(BankExportService);
  });

  const baseRun = {
    period: '2026-07',
    company: { tenantId: 'tenant-1' },
    entries: [
      {
        netPay: 45000,
        currency: 'KES',
        employee: {
          id: 'emp-1',
          employeeNumber: 'EMP001',
          firstName: 'Jane',
          lastName: 'Doe',
          bankAccountNumber: '1234567890',
          bankName: 'Equity Bank',
          bankCode: '068',
          bankBranchCode: '001',
        },
      },
    ],
  };

  it('generates a CSV with the correct headers and row values', async () => {
    prisma.payrollRun.findUnique.mockResolvedValueOnce(baseRun);

    const csv = await service.generateCsv('tenant-1', 'run-1');
    const [header, row] = csv.split('\n');

    expect(header).toBe(
      'employee_number,employee_name,account_number,bank_name,bank_code,branch_code,amount,currency,reference',
    );
    expect(row).toBe(
      'EMP001,Jane Doe,1234567890,Equity Bank,068,001,45000.00,KES,SAL-2026-07-EMP001',
    );
  });

  it('renders a MISSING placeholder when the employee has no bank details', async () => {
    const run = {
      ...baseRun,
      entries: [
        {
          netPay: 30000,
          currency: 'KES',
          employee: {
            id: 'emp-2',
            employeeNumber: 'EMP002',
            firstName: 'John',
            lastName: 'Smith',
            bankAccountNumber: null,
            bankName: null,
            bankCode: null,
            bankBranchCode: null,
          },
        },
      ],
    };
    prisma.payrollRun.findUnique.mockResolvedValueOnce(run);

    const csv = await service.generateCsv('tenant-1', 'run-2');
    const [, row] = csv.split('\n');

    expect(row).toContain('MISSING,MISSING');
  });

  it('throws NotFoundException when the run does not exist', async () => {
    prisma.payrollRun.findUnique.mockResolvedValueOnce(null);

    await expect(
      service.generateCsv('tenant-1', 'missing-run'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException for a run belonging to a different tenant', async () => {
    prisma.payrollRun.findUnique.mockResolvedValueOnce({
      ...baseRun,
      company: { tenantId: 'other-tenant' },
    });

    await expect(service.generateCsv('tenant-1', 'run-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('decrypts the bank account number before writing it to the CSV', async () => {
    prisma.payrollRun.findUnique.mockResolvedValueOnce(baseRun);

    await service.generateCsv('tenant-1', 'run-1');

    expect(encryptionService.decrypt).toHaveBeenCalledWith('1234567890');
  });

  it('CSV-escapes a value containing a comma', async () => {
    const run = {
      ...baseRun,
      entries: [
        {
          ...baseRun.entries[0],
          employee: {
            ...baseRun.entries[0].employee,
            bankName: 'Equity Bank, Nairobi',
          },
        },
      ],
    };
    prisma.payrollRun.findUnique.mockResolvedValueOnce(run);

    const csv = await service.generateCsv('tenant-1', 'run-1');
    const [, row] = csv.split('\n');

    expect(row).toContain('"Equity Bank, Nairobi"');
  });
});
