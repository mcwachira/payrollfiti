import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BrandingService } from './branding.service';
import { PrismaService } from '../prisma/prisma.service';

// jest.fn() with no type args resolves to Mock<UnknownFunction>, whose return
// type is `unknown` rather than `Promise<unknown>` — that makes the conditional
// type behind `.mockResolvedValue()` collapse to `never`. Pin the fn's shape to
// a promise-returning signature up front so mocks stay reassignable across cases.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('BrandingService', () => {
  let service: BrandingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      brandingConfig: { findUnique: asyncMock(null), upsert: asyncMock({}) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrandingService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: () => 'PayrollFiti' } },
      ],
    }).compile();

    service = module.get(BrandingService);
  });

  describe('getDefaultBranding', () => {
    it('returns the appName from config', () => {
      expect(service.getDefaultBranding()).toEqual({ appName: 'PayrollFiti' });
    });
  });

  describe('getBranding', () => {
    it('falls back to config appName when there is no branding row for the tenant', async () => {
      prisma.brandingConfig.findUnique.mockResolvedValueOnce(null);

      const result = await service.getBranding('tenant-1');

      expect(prisma.brandingConfig.findUnique).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
      expect(result).toEqual({
        appName: 'PayrollFiti',
        logoUrl: undefined,
        primaryColor: undefined,
        secondaryColor: undefined,
      });
    });

    it('returns the tenant-specific branding row when present', async () => {
      prisma.brandingConfig.findUnique.mockResolvedValueOnce({
        appName: 'Acme Payroll',
        logoUrl: 'https://acme.example.com/logo.png',
        primaryColor: '#111111',
        secondaryColor: '#222222',
      });

      const result = await service.getBranding('tenant-1');

      expect(result).toEqual({
        appName: 'Acme Payroll',
        logoUrl: 'https://acme.example.com/logo.png',
        primaryColor: '#111111',
        secondaryColor: '#222222',
      });
    });
  });

  describe('upsertBranding', () => {
    it('upserts the branding config scoped to the tenant', async () => {
      const dto = { appName: 'Acme Payroll', primaryColor: '#111111' };

      await service.upsertBranding('tenant-1', dto);

      expect(prisma.brandingConfig.upsert).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        create: { tenantId: 'tenant-1', ...dto },
        update: { ...dto },
      });
    });
  });
});
