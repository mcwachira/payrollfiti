import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { TenantsService } from '../tenants/tenants.service';

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

  const company = { id: 'company-1', tenantId: 'tenant-1', name: 'Acme' };
  const employee = {
    id: 'emp-1',
    companyId: 'company-1',
    firstName: 'Jane',
    lastName: 'Doe',
    status: 'ACTIVE',
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
      salaryStructure: { findFirst: asyncMock(null) },
    };
    tenantsService = { assertCompanyBelongsToTenant: asyncMock(company) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: TenantsService, useValue: tenantsService },
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
      const result = await service.create('tenant-1', dto);

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
      expect(result).toBe(employee);
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
    it('returns the employee when it belongs to the tenant', async () => {
      const result = await service.findOne('tenant-1', 'emp-1');

      expect(result).toBe(employee);
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
