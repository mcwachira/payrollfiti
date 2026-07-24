import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { PayrollRunStatus } from '@prisma/client';
import { kenyaV1 } from '@repo/payroll-rules';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EmployeesService } from '../employees/employees.service';
import { RulesCacheService } from './rules-cache.service';
import { AuditService } from '../audit/audit.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('PayrollService', () => {
  let service: PayrollService;

  const company = {
    id: 'company-1',
    tenantId: 'tenant-1',
    name: 'Acme',
    currency: 'KES',
  };
  const tenant = {
    id: 'tenant-1',
    countryCode: 'KE',
    name: 'Acme',
    defaultCurrency: 'KES',
  };
  const employee = {
    id: 'emp-1',
    companyId: 'company-1',
    firstName: 'Jane',
    lastName: 'Doe',
    status: 'ACTIVE',
  };
  const salaryStructure = {
    id: 'salary-1',
    employeeId: 'emp-1',
    basicSalary: 80_000,
    allowances: { transport: 5_000 },
    currency: 'KES',
    effectiveFrom: new Date('2024-01-01'),
    effectiveTo: null,
  };

  let prisma: any;
  let auditService: any;

  beforeEach(async () => {
    prisma = {
      tenant: { findUniqueOrThrow: asyncMock(tenant) },
      employee: { findMany: asyncMock([employee]) },
      payrollRun: { findUnique: asyncMock(null) },
      $transaction: jest.fn(),
    };
    auditService = { record: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TenantsService,
          useValue: { assertCompanyBelongsToTenant: asyncMock(company) },
        },
        {
          provide: EmployeesService,
          useValue: { getActiveSalaryStructure: asyncMock(salaryStructure) },
        },
        {
          provide: RulesCacheService,
          useValue: { resolve: asyncMock(kenyaV1) },
        },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(PayrollService);
  });

  const dto = {
    companyId: 'company-1',
    period: '2026-07',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
  };

  it('creates a payroll run with entries computed by the payroll engine', async () => {
    const createdRun = {
      id: 'run-1',
      status: PayrollRunStatus.COMPLETED,
      entries: [],
    };
    const txPrisma = {
      payrollRun: {
        create: asyncMock({ id: 'run-1' }),
        findUniqueOrThrow: asyncMock(createdRun),
      },
      payrollEntry: { create: asyncMock({}) },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

    const result = await service.runPayroll('tenant-1', 'user-1', dto);

    expect(result).toBe(createdRun);
    expect(txPrisma.payrollRun.create).toHaveBeenCalledTimes(1);
    expect(txPrisma.payrollEntry.create).toHaveBeenCalledTimes(1);
    const entryArgs = txPrisma.payrollEntry.create.mock.calls[0][0].data;
    expect(entryArgs.employeeId).toBe('emp-1');
    expect(entryArgs.netPay).toBeLessThan(entryArgs.grossPay);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payroll.run',
        entityType: 'PayrollRun',
      }),
    );
  });

  it('is idempotent: an identical run request returns the existing run instead of creating a new one', async () => {
    const existingRun = {
      id: 'run-existing',
      idempotencyKey: 'whatever',
      entries: [],
    };
    prisma.payrollRun.findUnique.mockResolvedValue(existingRun);

    const result = await service.runPayroll('tenant-1', 'user-1', dto);

    expect(result).toBe(existingRun);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('bypasses the idempotency cache when force is set', async () => {
    prisma.payrollRun.findUnique.mockResolvedValue({
      id: 'run-existing',
      entries: [],
    });
    const createdRun = { id: 'run-new', entries: [] };
    const txPrisma = {
      payrollRun: {
        create: asyncMock({ id: 'run-new' }),
        findUniqueOrThrow: asyncMock(createdRun),
      },
      payrollEntry: { create: asyncMock({}) },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

    const result = await service.runPayroll('tenant-1', 'user-1', {
      ...dto,
      force: true,
    });

    expect(result).toBe(createdRun);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('skips employees with no salary structure effective for the period', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayrollService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: TenantsService,
          useValue: { assertCompanyBelongsToTenant: asyncMock(company) },
        },
        {
          provide: EmployeesService,
          useValue: { getActiveSalaryStructure: asyncMock(null) },
        },
        {
          provide: RulesCacheService,
          useValue: { resolve: asyncMock(kenyaV1) },
        },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();
    const serviceWithoutSalary = module.get(PayrollService);

    const txPrisma = {
      payrollRun: {
        create: asyncMock({ id: 'run-empty' }),
        findUniqueOrThrow: asyncMock({ id: 'run-empty', entries: [] }),
      },
      payrollEntry: { create: jest.fn() },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

    await serviceWithoutSalary.runPayroll('tenant-1', 'user-1', dto);

    expect(txPrisma.payrollEntry.create).not.toHaveBeenCalled();
  });

  describe('findMine', () => {
    it('returns the payroll entries for the given employee, scoped to the tenant', async () => {
      prisma.payrollEntry = { findMany: asyncMock([{ id: 'entry-1' }]) };

      const result = await service.findMine('tenant-1', 'emp-1');

      expect(prisma.payrollEntry.findMany).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp-1',
          employee: { company: { tenantId: 'tenant-1' } },
        },
        include: { payrollRun: true },
        orderBy: { payrollRun: { periodStart: 'desc' } },
      });
      expect(result).toEqual([{ id: 'entry-1' }]);
    });

    it('returns an empty array without querying when the current user has no employeeId', async () => {
      prisma.payrollEntry = { findMany: jest.fn() };

      const result = await service.findMine('tenant-1', null);

      expect(result).toEqual([]);
      expect(prisma.payrollEntry.findMany).not.toHaveBeenCalled();
    });
  });
});
