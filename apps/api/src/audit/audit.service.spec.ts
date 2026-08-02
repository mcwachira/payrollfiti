import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AuditService } from './audit.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;

  const entry = {
    id: 'log-1',
    tenantId: 'tenant-1',
    actorId: 'user-1',
    action: 'employee.invite',
    entityType: 'employees',
    entityId: 'emp-1',
    createdAt: new Date('2026-08-01'),
    actor: { email: 'admin@acme.co.ke' },
  };

  beforeEach(() => {
    prisma = {
      auditLog: {
        create: asyncMock(undefined),
        findMany: asyncMock([entry]),
        count: asyncMock(1),
      },
    };
    service = new AuditService(prisma);
  });

  describe('record', () => {
    it('never throws even when the write fails', async () => {
      prisma.auditLog.create.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.record({
          tenantId: 'tenant-1',
          action: 'employee.invite',
          entityType: 'employees',
          entityId: 'emp-1',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('defaults to page 1 / limit 25 and scopes to the tenant', async () => {
      const result = await service.list('tenant-1', {});

      expect(result).toEqual({ items: [entry], total: 1, page: 1, limit: 25 });
      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          skip: 0,
          take: 25,
        }),
      );
    });

    it('applies entityType/actorId/action filters and pagination offsets', async () => {
      await service.list('tenant-1', {
        entityType: 'employees',
        actorId: 'user-1',
        action: 'invite',
        page: 3,
        limit: 10,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId: 'tenant-1',
            entityType: 'employees',
            actorId: 'user-1',
            action: { contains: 'invite', mode: 'insensitive' },
          },
          skip: 20,
          take: 10,
        }),
      );
      expect(prisma.auditLog.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          entityType: 'employees',
          actorId: 'user-1',
          action: { contains: 'invite', mode: 'insensitive' },
        },
      });
    });
  });
});
