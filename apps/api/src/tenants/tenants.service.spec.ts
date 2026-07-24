import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { PrismaService } from '../prisma/prisma.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: any;

  const tenant = {
    id: 'tenant-1',
    name: 'Acme',
    countryCode: 'KE',
    branding: null,
  };
  const company = {
    id: 'company-1',
    tenantId: 'tenant-1',
    name: 'Acme HQ',
    currency: 'KES',
  };

  beforeEach(async () => {
    prisma = {
      tenant: { findUnique: asyncMock(tenant) },
      company: {
        create: asyncMock(company),
        findMany: asyncMock([company]),
        findFirst: asyncMock(company),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [TenantsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(TenantsService);
  });

  describe('getTenant', () => {
    it('returns the tenant with branding included', async () => {
      const result = await service.getTenant('tenant-1');

      expect(prisma.tenant.findUnique).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        include: { branding: true },
      });
      expect(result).toBe(tenant);
    });

    it('throws NotFoundException when the tenant does not exist', async () => {
      prisma.tenant.findUnique.mockResolvedValueOnce(null);

      await expect(service.getTenant('missing-tenant')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createCompany', () => {
    it('creates a company scoped to the given tenant, defaulting currency to KES', async () => {
      const result = await service.createCompany('tenant-1', {
        name: 'Acme HQ',
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', name: 'Acme HQ', currency: 'KES' },
      });
      expect(result).toBe(company);
    });

    it('uses the provided currency when supplied', async () => {
      await service.createCompany('tenant-1', {
        name: 'Acme HQ',
        currency: 'NGN',
      });

      expect(prisma.company.create).toHaveBeenCalledWith({
        data: { tenantId: 'tenant-1', name: 'Acme HQ', currency: 'NGN' },
      });
    });
  });

  describe('listCompanies', () => {
    it('scopes the query to the given tenant', async () => {
      const result = await service.listCompanies('tenant-1');

      expect(prisma.company.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
      expect(result).toEqual([company]);
    });
  });

  describe('assertCompanyBelongsToTenant', () => {
    it('returns the company when it belongs to the tenant', async () => {
      const result = await service.assertCompanyBelongsToTenant(
        'company-1',
        'tenant-1',
      );

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { id: 'company-1', tenantId: 'tenant-1' },
      });
      expect(result).toBe(company);
    });

    it('throws NotFoundException when the company does not belong to the tenant (tenant isolation)', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(null);

      await expect(
        service.assertCompanyBelongsToTenant('company-1', 'other-tenant'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { id: 'company-1', tenantId: 'other-tenant' },
      });
    });
  });
});
