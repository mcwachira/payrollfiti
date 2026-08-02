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
      contract: { updateMany: asyncMock({ count: 1 }) },
      user: { updateMany: asyncMock({ count: 1 }) },
      salaryStructure: { findFirst: asyncMock(null) },
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
});
