import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SalaryComponentsService } from './salary-components.service';
import { PrismaService } from '../prisma/prisma.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('SalaryComponentsService', () => {
  let service: SalaryComponentsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      salaryComponent: {
        create: asyncMock({}),
        findMany: asyncMock([]),
        findUnique: asyncMock(null),
        update: asyncMock({}),
      },
      salaryStructureComponent: {
        findMany: asyncMock([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalaryComponentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SalaryComponentsService);
  });

  describe('create / findAll', () => {
    it('creates a component scoped to the tenant', async () => {
      await service.create('tenant-1', {
        name: 'Transport',
        code: 'TRANSPORT',
        type: 'EARNING' as any,
      });
      expect(prisma.salaryComponent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            code: 'TRANSPORT',
          }),
        }),
      );
    });

    it('finds all active components scoped to the tenant by default', async () => {
      await service.findAll('tenant-1');
      expect(prisma.salaryComponent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', isActive: true },
      });
    });
  });

  describe('findOne / update', () => {
    it('throws NotFoundException for a component belonging to another tenant', async () => {
      prisma.salaryComponent.findUnique.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-2',
      });

      await expect(service.findOne('tenant-1', 'comp-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException on update for a component belonging to another tenant', async () => {
      prisma.salaryComponent.findUnique.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-2',
      });

      await expect(
        service.update('tenant-1', 'comp-1', { name: 'X' } as any),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.salaryComponent.update).not.toHaveBeenCalled();
    });

    it('updates a component belonging to the tenant', async () => {
      prisma.salaryComponent.findUnique.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
      });

      await service.update('tenant-1', 'comp-1', { name: 'X' } as any);
      expect(prisma.salaryComponent.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { name: 'X' },
      });
    });
  });

  describe('deactivate', () => {
    it('soft-deletes by setting isActive: false', async () => {
      prisma.salaryComponent.findUnique.mockResolvedValue({
        id: 'comp-1',
        tenantId: 'tenant-1',
      });

      await service.deactivate('tenant-1', 'comp-1');
      expect(prisma.salaryComponent.update).toHaveBeenCalledWith({
        where: { id: 'comp-1' },
        data: { isActive: false },
      });
    });
  });

  describe('resolveStructureEarnings', () => {
    it('computes FIXED amounts using the line override, falling back to the component default', async () => {
      prisma.salaryStructureComponent.findMany.mockResolvedValue([
        {
          amount: null,
          rate: null,
          salaryComponent: {
            code: 'TRANSPORT',
            type: 'EARNING',
            calcType: 'FIXED',
            defaultAmount: 5000,
            defaultRate: null,
          },
        },
        {
          amount: 2000,
          rate: null,
          salaryComponent: {
            code: 'MEAL',
            type: 'EARNING',
            calcType: 'FIXED',
            defaultAmount: 1000,
            defaultRate: null,
          },
        },
      ]);

      const result = await service.resolveStructureEarnings(
        'structure-1',
        80_000,
      );

      expect(result.allowances).toEqual({ TRANSPORT: 5000, MEAL: 2000 });
      expect(result.voluntaryDeductions).toEqual({});
    });

    it('computes PERCENTAGE_OF_BASIC amounts as basicSalary * rate/100, rounded', async () => {
      prisma.salaryStructureComponent.findMany.mockResolvedValue([
        {
          amount: null,
          rate: null,
          salaryComponent: {
            code: 'HOUSING',
            type: 'EARNING',
            calcType: 'PERCENTAGE_OF_BASIC',
            defaultAmount: null,
            defaultRate: 12.5,
          },
        },
      ]);

      const result = await service.resolveStructureEarnings(
        'structure-1',
        80_000,
      );

      expect(result.allowances).toEqual({ HOUSING: 10_000 });
    });

    it('splits EARNING vs DEDUCTION component types into the right buckets', async () => {
      prisma.salaryStructureComponent.findMany.mockResolvedValue([
        {
          amount: 3000,
          rate: null,
          salaryComponent: {
            code: 'TRANSPORT',
            type: 'EARNING',
            calcType: 'FIXED',
            defaultAmount: null,
            defaultRate: null,
          },
        },
        {
          amount: 1500,
          rate: null,
          salaryComponent: {
            code: 'LOAN_REPAYMENT',
            type: 'DEDUCTION',
            calcType: 'FIXED',
            defaultAmount: null,
            defaultRate: null,
          },
        },
      ]);

      const result = await service.resolveStructureEarnings(
        'structure-1',
        80_000,
      );

      expect(result.allowances).toEqual({ TRANSPORT: 3000 });
      expect(result.voluntaryDeductions).toEqual({ LOAN_REPAYMENT: 1500 });
    });

    it('falls back to legacy allowances JSON when no component rows exist', async () => {
      prisma.salaryStructureComponent.findMany.mockResolvedValue([]);

      const result = await service.resolveStructureEarnings(
        'structure-1',
        80_000,
        { transport: 5000 },
      );

      expect(result).toEqual({
        allowances: { transport: 5000 },
        voluntaryDeductions: {},
      });
    });

    it('returns empty maps when there are no component rows and no legacy allowances', async () => {
      prisma.salaryStructureComponent.findMany.mockResolvedValue([]);

      const result = await service.resolveStructureEarnings(
        'structure-1',
        80_000,
        null,
      );

      expect(result).toEqual({ allowances: {}, voluntaryDeductions: {} });
    });
  });
});
