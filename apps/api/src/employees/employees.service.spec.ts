import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { AuditService } from '../audit/audit.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: any;
  let tenantsService: any;
  let encryptionService: any;
  let auditService: any;

  const company = { id: 'company-1', tenantId: 'tenant-1', name: 'Acme' };
  const employee = {
    id: 'emp-1',
    companyId: 'company-1',
    firstName: 'Jane',
    lastName: 'Doe',
    status: 'ACTIVE',
    kraPin: 'enc:A123456789Z',
    nssfNumber: 'enc:NSSF-1',
    nhifNumber: 'enc:NHIF-1',
    bankAccountNumber: 'enc:1234567890',
    company,
  };

  beforeEach(async () => {
    prisma = {
      employee: {
        create: asyncMock(employee),
        findMany: asyncMock([employee]),
        findUnique: asyncMock(employee),
        update: asyncMock({ ...employee, status: 'INACTIVE' }),
      },
      tenant: { findUniqueOrThrow: asyncMock({ countryCode: 'KE' }) },
      contract: { updateMany: asyncMock({ count: 1 }) },
      user: { updateMany: asyncMock({ count: 1 }) },
      salaryStructure: { findFirst: asyncMock(null) },
      onboardingTask: {
        createMany: asyncMock({ count: 7 }),
        findMany: asyncMock([]),
        aggregate: asyncMock({ _max: { order: null } }),
        create: asyncMock({
          id: 'task-1',
          employeeId: 'emp-1',
          title: 'Custom task',
          isRequired: true,
          completed: false,
          order: 0,
        }),
        update: asyncMock({
          id: 'task-1',
          employeeId: 'emp-1',
          title: 'KRA PIN collected',
          isRequired: true,
          completed: true,
        }),
        count: asyncMock(0),
        findFirst: asyncMock({
          id: 'task-1',
          employeeId: 'emp-1',
          title: 'KRA PIN collected',
        }),
      },
    };
    prisma.$transaction = jest.fn((fn: any) => fn(prisma));
    tenantsService = { assertCompanyBelongsToTenant: asyncMock(company) };
    auditService = { record: asyncMock(undefined) };
    // Identity-ish mocks: prefix on encrypt, strip prefix on decrypt — lets
    // tests assert the encrypt/decrypt calls actually happened without
    // duplicating round-trip correctness, which encryption.service.spec.ts
    // already covers.
    encryptionService = {
      encrypt: jest.fn((v: string | null | undefined) =>
        v ? `enc:${v}` : null,
      ),
      decrypt: jest.fn((v: string | null | undefined) =>
        v ? String(v).replace(/^enc:/, '') : null,
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantsService, useValue: tenantsService },
        { provide: EncryptionService, useValue: encryptionService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(EmployeesService);
  });

  describe('create', () => {
    const dto = {
      companyId: 'company-1',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@acme.co.ke',
    };

    it('validates the company belongs to the tenant before creating the employee', async () => {
      const result = await service.create('tenant-1', {
        ...dto,
        kraPin: 'A123456789Z',
        bankAccountNumber: '1234567890',
      });

      expect(tenantsService.assertCompanyBelongsToTenant).toHaveBeenCalledWith(
        'company-1',
        'tenant-1',
      );
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'company-1',
            currency: 'KES',
          }),
        }),
      );
      // The mocked prisma.employee.create resolves the fixed `employee`
      // fixture regardless of input — this asserts the service decrypts
      // whatever prisma returns, not that it echoes the dto back verbatim.
      expect(result).toEqual({
        ...employee,
        kraPin: 'A123456789Z',
        nssfNumber: 'NSSF-1',
        nhifNumber: 'NHIF-1',
        taxIdNumber: null,
        pensionNumber: null,
        bankAccountNumber: '1234567890',
      });
    });

    it('encrypts kraPin, nssfNumber, nhifNumber and bankAccountNumber before writing to the database', async () => {
      await service.create('tenant-1', {
        ...dto,
        kraPin: 'A123456789Z',
        nssfNumber: 'NSSF-1',
        nhifNumber: 'NHIF-1',
        bankAccountNumber: '1234567890',
      });

      expect(encryptionService.encrypt).toHaveBeenCalledWith('A123456789Z');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('NSSF-1');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('NHIF-1');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('1234567890');
      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kraPin: 'enc:A123456789Z',
            nssfNumber: 'enc:NSSF-1',
            nhifNumber: 'enc:NHIF-1',
            bankAccountNumber: 'enc:1234567890',
          }),
        }),
      );
    });

    it('propagates NotFoundException when the company does not belong to the tenant', async () => {
      tenantsService.assertCompanyBelongsToTenant.mockRejectedValueOnce(
        new NotFoundException('Company not found for this tenant'),
      );

      await expect(service.create('tenant-1', dto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.employee.create).not.toHaveBeenCalled();
    });

    it('starts the employee in ONBOARDING status and seeds a default checklist', async () => {
      await service.create('tenant-1', dto);

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ONBOARDING' }),
        }),
      );
      expect(prisma.onboardingTask.createMany).toHaveBeenCalledTimes(1);
      const seeded = prisma.onboardingTask.createMany.mock.calls[0][0].data;
      expect(seeded.every((t: any) => t.employeeId === 'emp-1')).toBe(true);
      expect(seeded.map((t: any) => t.title)).toContain(
        'KRA PIN collected',
      );
    });

    it('seeds a Nigeria-specific checklist for an NG tenant', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        countryCode: 'NG',
      });

      await service.create('tenant-1', dto);

      const seeded = prisma.onboardingTask.createMany.mock.calls[0][0].data;
      const titles = seeded.map((t: any) => t.title);
      expect(titles).toContain(
        'Tax Identification Number (TIN) collected',
      );
      expect(titles).not.toContain('KRA PIN collected');
    });

    it('defaults currency from the tenant country rather than hardcoding KES', async () => {
      prisma.tenant.findUniqueOrThrow.mockResolvedValueOnce({
        countryCode: 'NG',
      });

      await service.create('tenant-1', dto);

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'NGN' }),
        }),
      );
    });

    it('uses the provided currency when supplied, regardless of tenant country', async () => {
      await service.create('tenant-1', { ...dto, currency: 'USD' });

      expect(prisma.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'USD' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the employee when it belongs to the tenant, with PII decrypted', async () => {
      const result = await service.findOne('tenant-1', 'emp-1');

      expect(result).toEqual({
        ...employee,
        kraPin: 'A123456789Z',
        nssfNumber: 'NSSF-1',
        nhifNumber: 'NHIF-1',
        taxIdNumber: null,
        pensionNumber: null,
        bankAccountNumber: '1234567890',
      });
    });

    it('decrypts kraPin, nssfNumber, nhifNumber and bankAccountNumber before returning', async () => {
      await service.findOne('tenant-1', 'emp-1');

      expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:A123456789Z');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:NSSF-1');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:NHIF-1');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('enc:1234567890');
    });

    it('throws NotFoundException when the employee does not exist', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne('tenant-1', 'missing-emp')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for a cross-tenant employee (tenant isolation)', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        ...employee,
        company: { ...company, tenantId: 'other-tenant' },
      });

      await expect(service.findOne('tenant-1', 'emp-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting status to INACTIVE rather than a hard delete', async () => {
      const result = await service.remove('tenant-1', 'emp-1');

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { status: 'INACTIVE' },
      });
      expect(result.status).toBe('INACTIVE');
    });

    it('throws NotFoundException for a cross-tenant employee before attempting the update', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove('tenant-1', 'missing-emp')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe('terminate', () => {
    beforeEach(() => {
      prisma.employee.update.mockResolvedValue({
        ...employee,
        status: 'TERMINATED',
        terminatedAt: new Date('2026-07-15'),
        terminationReason: 'Resignation',
      });
    });

    it('marks the employee TERMINATED, closes open contracts, and revokes portal access — all in one transaction', async () => {
      await service.terminate('tenant-1', 'actor-1', 'emp-1', {
        terminationDate: '2026-07-15',
        reason: 'Resignation',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: {
          status: 'TERMINATED',
          terminatedAt: new Date('2026-07-15'),
          terminationReason: 'Resignation',
        },
      });
      expect(prisma.contract.updateMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', endDate: null },
        data: { endDate: new Date('2026-07-15') },
      });
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1' },
        data: { isActive: false, refreshTokenHash: null },
      });
    });

    it('defaults the termination date to now when not provided', async () => {
      await service.terminate('tenant-1', 'actor-1', 'emp-1', {});

      const updateArgs = prisma.employee.update.mock.calls[0][0];
      expect(updateArgs.data.terminatedAt).toBeInstanceOf(Date);
    });

    it('records an audit entry with the actor and before/after status', async () => {
      await service.terminate('tenant-1', 'actor-1', 'emp-1', {
        terminationDate: '2026-07-15',
        reason: 'Resignation',
      });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorId: 'actor-1',
          action: 'employee.terminate',
          entityType: 'Employee',
          entityId: 'emp-1',
          before: { status: 'ACTIVE' },
          after: expect.objectContaining({
            status: 'TERMINATED',
            reason: 'Resignation',
          }),
        }),
      );
    });

    it('throws BadRequestException if the employee is already terminated', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        ...employee,
        status: 'TERMINATED',
      });

      await expect(
        service.terminate('tenant-1', 'actor-1', 'emp-1', {}),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a cross-tenant employee before attempting anything', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.terminate('tenant-1', 'actor-1', 'missing-emp', {}),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getActiveSalaryStructure', () => {
    it('queries for a structure effective as of the given date, most-recent first', async () => {
      const asOf = new Date('2026-07-01');
      await service.getActiveSalaryStructure('emp-1', asOf);

      expect(prisma.salaryStructure.findFirst).toHaveBeenCalledWith({
        where: {
          employeeId: 'emp-1',
          effectiveFrom: { lte: asOf },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });
    });

    it('returns null when no salary structure is effective for the period', async () => {
      const result = await service.getActiveSalaryStructure(
        'emp-1',
        new Date('2026-07-01'),
      );

      expect(result).toBeNull();
    });
  });

  describe('listOnboardingTasks', () => {
    it('verifies tenant ownership then lists tasks ordered by `order`', async () => {
      await service.listOnboardingTasks('tenant-1', 'emp-1');

      expect(prisma.onboardingTask.findMany).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1' },
        orderBy: { order: 'asc' },
      });
    });

    it('throws NotFoundException for a cross-tenant employee', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.listOnboardingTasks('tenant-1', 'missing-emp'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('addOnboardingTask', () => {
    it('appends after the current max order', async () => {
      prisma.onboardingTask.aggregate.mockResolvedValueOnce({
        _max: { order: 3 },
      });

      await service.addOnboardingTask('tenant-1', 'emp-1', {
        title: 'Custom task',
      });

      expect(prisma.onboardingTask.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          title: 'Custom task',
          isRequired: true,
          order: 4,
        },
      });
    });

    it('starts at order 0 when no tasks exist yet', async () => {
      await service.addOnboardingTask('tenant-1', 'emp-1', {
        title: 'Custom task',
        isRequired: false,
      });

      expect(prisma.onboardingTask.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          title: 'Custom task',
          isRequired: false,
          order: 0,
        },
      });
    });
  });

  describe('updateOnboardingTask', () => {
    it('marks a task completed and stamps completedAt', async () => {
      await service.updateOnboardingTask('tenant-1', 'emp-1', 'task-1', {
        completed: true,
      });

      const updateArgs = prisma.onboardingTask.update.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'task-1' });
      expect(updateArgs.data.completed).toBe(true);
      expect(updateArgs.data.completedAt).toBeInstanceOf(Date);
    });

    it('clears completedAt when marking a task incomplete again', async () => {
      await service.updateOnboardingTask('tenant-1', 'emp-1', 'task-1', {
        completed: false,
      });

      const updateArgs = prisma.onboardingTask.update.mock.calls[0][0];
      expect(updateArgs.data).toEqual({
        completed: false,
        completedAt: null,
      });
    });

    it('throws NotFoundException when the task does not belong to this employee', async () => {
      prisma.onboardingTask.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.updateOnboardingTask('tenant-1', 'emp-1', 'task-x', {
          completed: true,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.onboardingTask.update).not.toHaveBeenCalled();
    });
  });

  describe('completeOnboarding', () => {
    beforeEach(() => {
      prisma.employee.findUnique.mockResolvedValue({
        ...employee,
        status: 'ONBOARDING',
      });
      prisma.employee.update.mockResolvedValue({
        ...employee,
        status: 'ACTIVE',
      });
    });

    it('activates the employee when no required tasks remain', async () => {
      prisma.onboardingTask.count.mockResolvedValueOnce(0);

      const result = await service.completeOnboarding(
        'tenant-1',
        'actor-1',
        'emp-1',
      );

      expect(prisma.onboardingTask.count).toHaveBeenCalledWith({
        where: { employeeId: 'emp-1', isRequired: true, completed: false },
      });
      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: { status: 'ACTIVE' },
      });
      expect(result.status).toBe('ACTIVE');
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'employee.onboarding.complete',
          before: { status: 'ONBOARDING' },
          after: { status: 'ACTIVE' },
        }),
      );
    });

    it('refuses when required tasks are still incomplete', async () => {
      prisma.onboardingTask.count.mockResolvedValueOnce(2);

      await expect(
        service.completeOnboarding('tenant-1', 'actor-1', 'emp-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });

    it('refuses when the employee is not currently in ONBOARDING status', async () => {
      prisma.employee.findUnique.mockResolvedValueOnce({
        ...employee,
        status: 'ACTIVE',
      });

      await expect(
        service.completeOnboarding('tenant-1', 'actor-1', 'emp-1'),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.onboardingTask.count).not.toHaveBeenCalled();
    });
  });
});
