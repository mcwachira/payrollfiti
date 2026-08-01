import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { ApiKeysService } from './api-keys.service';
import { PrismaService } from '../prisma/prisma.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      apiKey: {
        create: asyncMock({}),
        findMany: asyncMock([]),
        findUnique: asyncMock(null),
        findFirst: asyncMock(null),
        update: asyncMock({}),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeysService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ApiKeysService);
  });

  describe('create', () => {
    it('persists only the hashed key and returns the raw key exactly once', async () => {
      prisma.apiKey.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'key-1', ...args.data }),
      );

      const { apiKey, rawKey } = await service.create('tenant-1', 'user-1', {
        name: 'CI integration',
      });

      expect(rawKey.startsWith('pfk_')).toBe(true);
      expect(apiKey.hashedKey).toBe(
        createHash('sha256').update(rawKey).digest('hex'),
      );
      expect(apiKey.keyPrefix).toBe(rawKey.slice(0, 12));
      expect(prisma.apiKey.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            createdById: 'user-1',
            name: 'CI integration',
          }),
        }),
      );
    });
  });

  describe('list', () => {
    it('never selects hashedKey', async () => {
      await service.list('tenant-1');
      const call = prisma.apiKey.findMany.mock.calls[0][0];
      expect(call.select).toBeDefined();
      expect(call.select.hashedKey).toBeUndefined();
      expect(Object.keys(call.select)).not.toContain('hashedKey');
    });
  });

  describe('revoke', () => {
    it('throws NotFoundException for another tenant key id', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        tenantId: 'tenant-2',
      });

      await expect(service.revoke('tenant-1', 'key-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('sets revokedAt for a key belonging to the tenant', async () => {
      prisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-1',
        tenantId: 'tenant-1',
      });

      await service.revoke('tenant-1', 'key-1');

      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('validate', () => {
    it('returns null for an unknown key', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);
      const result = await service.validate('pfk_unknown');
      expect(result).toBeNull();
      expect(prisma.apiKey.update).not.toHaveBeenCalled();
    });

    it('returns null for a revoked key (excluded by the revokedAt: null filter)', async () => {
      prisma.apiKey.findFirst.mockResolvedValue(null);
      const result = await service.validate('pfk_revoked');
      expect(result).toBeNull();
      expect(prisma.apiKey.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ revokedAt: null }),
        }),
      );
    });

    it('returns the tenantId and updates lastUsedAt for a valid key', async () => {
      prisma.apiKey.findFirst.mockResolvedValue({
        id: 'key-1',
        tenantId: 'tenant-1',
      });

      const result = await service.validate('pfk_valid');

      expect(result).toEqual({ tenantId: 'tenant-1' });
      expect(prisma.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });
});
