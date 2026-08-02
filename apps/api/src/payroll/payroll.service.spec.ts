import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollRunStatus, Role } from '@prisma/client';
import { kenyaV1 } from '@repo/payroll-rules';
import { PayrollService } from './payroll.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EmployeesService } from '../employees/employees.service';
import { RulesCacheService } from './rules-cache.service';
import { AuditService } from '../audit/audit.service';
import { SalaryComponentsService } from '../salary-components/salary-components.service';
import { PayslipEmailService } from '../notifications/payslip-email.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { LoansService } from '../loans/loans.service';

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
  let salaryComponentsService: any;
  let payslipEmailService: any;
  let notificationsService: any;
  let webhooksService: any;
  let loansService: any;
  let employeesService: any;

  beforeEach(async () => {
    prisma = {
      tenant: { findUniqueOrThrow: asyncMock(tenant) },
      employee: { findMany: asyncMock([employee]) },
      payrollRun: { findUnique: asyncMock(null) },
      $transaction: jest.fn(),
    };
    auditService = { record: jest.fn() };
    salaryComponentsService = {
      resolveStructureEarnings: asyncMock({
        allowances: {},
        voluntaryDeductions: {},
      }),
    };
    payslipEmailService = {
      enqueueForRun: asyncMock(undefined),
    };
    notificationsService = {
      dispatchForRoles: asyncMock(undefined),
    };
    webhooksService = {
      dispatch: asyncMock(undefined),
    };
    loansService = {
      resolvePayrollDeductions: asyncMock({
        voluntaryDeductions: {},
        repayments: [],
      }),
      markRepaymentsPaid: asyncMock(undefined),
    };
    employeesService = {
      getActiveSalaryStructure: asyncMock(salaryStructure),
    };

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
          useValue: employeesService,
        },
        {
          provide: RulesCacheService,
          useValue: { resolve: asyncMock(kenyaV1) },
        },
        { provide: AuditService, useValue: auditService },
        {
          provide: SalaryComponentsService,
          useValue: salaryComponentsService,
        },
        { provide: PayslipEmailService, useValue: payslipEmailService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: LoansService, useValue: loansService },
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
    const runArgs = txPrisma.payrollRun.create.mock.calls[0][0].data;
    expect(runArgs.isOffCycle).toBe(false);
    expect(payslipEmailService.enqueueForRun).toHaveBeenCalledWith(
      'tenant-1',
      'run-1',
    );
    expect(notificationsService.dispatchForRoles).toHaveBeenCalledWith(
      'tenant-1',
      [Role.ADMIN, Role.HR],
      'PAYROLL_RUN_COMPLETED',
      expect.any(String),
      expect.objectContaining({
        metadata: expect.objectContaining({ runId: 'run-1' }),
      }),
    );
  });

  it('rejects the run when an employee salary structure currency does not match the country currency', async () => {
    employeesService.getActiveSalaryStructure.mockResolvedValueOnce({
      ...salaryStructure,
      currency: 'USD',
    });

    await expect(
      service.runPayroll('tenant-1', 'user-1', dto),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('folds due loan installments into voluntary deductions and marks them paid against the created entry', async () => {
    loansService.resolvePayrollDeductions.mockResolvedValueOnce({
      voluntaryDeductions: { LOAN_REPAYMENT_loan1: 10_000 },
      repayments: [{ id: 'rep-1', loanId: 'loan-1', amountDue: 10_000 }],
    });
    const createdRun = {
      id: 'run-1',
      status: PayrollRunStatus.COMPLETED,
      entries: [{ id: 'entry-1', employeeId: 'emp-1' }],
    };
    const txPrisma = {
      payrollRun: {
        create: asyncMock({ id: 'run-1' }),
        findUniqueOrThrow: asyncMock(createdRun),
      },
      payrollEntry: { create: asyncMock({}) },
    };
    prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

    await service.runPayroll('tenant-1', 'user-1', dto);

    expect(loansService.resolvePayrollDeductions).toHaveBeenCalledWith(
      'tenant-1',
      'emp-1',
      '2026-07',
    );
    const entryArgs = txPrisma.payrollEntry.create.mock.calls[0][0].data;
    expect(entryArgs.totalVoluntaryDeductions).toBeGreaterThan(0);
    expect(loansService.markRepaymentsPaid).toHaveBeenCalledWith(
      [{ id: 'rep-1', loanId: 'loan-1', amountDue: 10_000 }],
      'entry-1',
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
        {
          provide: SalaryComponentsService,
          useValue: salaryComponentsService,
        },
        { provide: PayslipEmailService, useValue: payslipEmailService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: WebhooksService, useValue: webhooksService },
        { provide: LoansService, useValue: loansService },
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

  describe('idempotency-key regression', () => {
    it('computes the exact same idempotencyKey string as before the off-cycle/correction refactor, for an ordinary run', async () => {
      // Fixture mirrors the "creates a payroll run" test above exactly —
      // same company/tenant/employee/salaryStructure/dto/ruleset — with
      // SalaryComponentsService mocked to resolve the same allowances the
      // legacy `salaryStructure.allowances` fallback used to supply
      // directly, and no voluntary deductions (today's universal case).
      // This value was captured from the pre-refactor implementation
      // before any Batch A code was written.
      const CAPTURED_BEFORE_REFACTOR =
        'bc1f6c294764909dab6271524e3af50998aa965b65964122bb743fd0bd29b202';

      salaryComponentsService.resolveStructureEarnings.mockResolvedValue({
        allowances: salaryStructure.allowances,
        voluntaryDeductions: {},
      });

      const createdRun = { id: 'run-1', entries: [] };
      const txPrisma = {
        payrollRun: {
          create: asyncMock({ id: 'run-1' }),
          findUniqueOrThrow: asyncMock(createdRun),
        },
        payrollEntry: { create: asyncMock({}) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      await service.runPayroll('tenant-1', 'user-1', dto);

      const runArgs = txPrisma.payrollRun.create.mock.calls[0][0].data;
      expect(runArgs.idempotencyKey).toBe(CAPTURED_BEFORE_REFACTOR);
    });
  });

  describe('runOffCyclePayroll', () => {
    const offCycleDto = {
      companyId: 'company-1',
      employeeIds: ['emp-1'],
      period: '2026-07',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      reason: 'Missed bonus for July',
    };

    it('persists isOffCycle: true and the reason, and filters employees to the given ids', async () => {
      const createdRun = { id: 'run-off-1', entries: [] };
      const txPrisma = {
        payrollRun: {
          create: asyncMock({ id: 'run-off-1' }),
          findUniqueOrThrow: asyncMock(createdRun),
        },
        payrollEntry: { create: asyncMock({}) },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      const result = await service.runOffCyclePayroll(
        'tenant-1',
        'user-1',
        offCycleDto,
      );

      expect(result).toBe(createdRun);
      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: {
          companyId: 'company-1',
          status: 'ACTIVE',
          id: { in: ['emp-1'] },
        },
      });
      const runArgs = txPrisma.payrollRun.create.mock.calls[0][0].data;
      expect(runArgs.isOffCycle).toBe(true);
      expect(runArgs.reason).toBe('Missed bonus for July');
    });
  });

  describe('createCorrection', () => {
    const originalEntry = {
      id: 'entry-1',
      employeeId: 'emp-1',
      payrollRunId: 'run-1',
      employee: {
        ...employee,
        company: { id: 'company-1', tenantId: 'tenant-1' },
      },
      payrollRun: {
        id: 'run-1',
        status: PayrollRunStatus.COMPLETED,
        companyId: 'company-1',
        period: '2026-07',
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        countryCode: 'KE',
        currency: 'KES',
        ruleVersion: kenyaV1.version,
      },
    };
    const correctionDto = {
      reason: 'Basic salary was understated',
      basicSalary: 85_000,
    };

    it('throws BadRequestException when the original run is not COMPLETED', async () => {
      prisma.payrollEntry = {
        findUnique: asyncMock({
          ...originalEntry,
          payrollRun: { ...originalEntry.payrollRun, status: 'DRAFT' },
        }),
      };

      await expect(
        service.createCorrection(
          'tenant-1',
          'user-1',
          'entry-1',
          correctionDto,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for a cross-tenant entry', async () => {
      prisma.payrollEntry = {
        findUnique: asyncMock({
          ...originalEntry,
          employee: {
            ...employee,
            company: { id: 'company-2', tenantId: 'tenant-2' },
          },
        }),
      };

      await expect(
        service.createCorrection(
          'tenant-1',
          'user-1',
          'entry-1',
          correctionDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the entry does not exist', async () => {
      prisma.payrollEntry = { findUnique: asyncMock(null) };

      await expect(
        service.createCorrection(
          'tenant-1',
          'user-1',
          'entry-missing',
          correctionDto,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a correction with correct linkage between the original and corrected entries', async () => {
      prisma.payrollEntry = { findUnique: asyncMock(originalEntry) };
      const txPrisma = {
        payrollRun: { create: asyncMock({ id: 'run-correction-1' }) },
        payrollEntry: { create: asyncMock({ id: 'entry-2' }) },
        payrollCorrection: {
          create: asyncMock({
            id: 'correction-1',
            originalEntryId: 'entry-1',
            correctedEntryId: 'entry-2',
            reason: correctionDto.reason,
            createdById: 'user-1',
          }),
        },
      };
      prisma.$transaction.mockImplementation((cb: any) => cb(txPrisma));

      const result = await service.createCorrection(
        'tenant-1',
        'user-1',
        'entry-1',
        correctionDto,
      );

      expect(txPrisma.payrollRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOffCycle: true,
            reason: correctionDto.reason,
            companyId: 'company-1',
          }),
        }),
      );
      expect(txPrisma.payrollCorrection.create).toHaveBeenCalledWith({
        data: {
          originalEntryId: 'entry-1',
          correctedEntryId: 'entry-2',
          reason: correctionDto.reason,
          createdById: 'user-1',
        },
      });
      expect(result.originalEntryId).toBe('entry-1');
      expect(result.correctedEntryId).toBe('entry-2');
      expect(result.correctedEntry).toEqual({ id: 'entry-2' });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payroll.correction',
          entityType: 'PayrollEntry',
          entityId: 'entry-1',
        }),
      );
    });
  });

  describe('listCorrections', () => {
    it('lists corrections for the original entry once tenant ownership is confirmed', async () => {
      prisma.payrollEntry = {
        findUnique: asyncMock({
          id: 'entry-1',
          employee: {
            ...employee,
            company: { id: 'company-1', tenantId: 'tenant-1' },
          },
        }),
      };
      prisma.payrollCorrection = {
        findMany: asyncMock([{ id: 'correction-1' }]),
      };

      const result = await service.listCorrections('tenant-1', 'entry-1');

      expect(prisma.payrollCorrection.findMany).toHaveBeenCalledWith({
        where: { originalEntryId: 'entry-1' },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual([{ id: 'correction-1' }]);
    });

    it('throws NotFoundException for a cross-tenant entry', async () => {
      prisma.payrollEntry = {
        findUnique: asyncMock({
          id: 'entry-1',
          employee: {
            ...employee,
            company: { id: 'company-2', tenantId: 'tenant-2' },
          },
        }),
      };

      await expect(
        service.listCorrections('tenant-1', 'entry-1'),
      ).rejects.toThrow(NotFoundException);
    });
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
