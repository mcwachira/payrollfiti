import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { NotificationChannel } from './notification-channel.enum';
import { NOTIFICATIONS_QUEUE, NOTIFICATION_DELIVER_JOB } from './notifications.queue';
import { PrismaService } from '../prisma/prisma.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: any;
  let queue: any;

  const notification = {
    id: 'notif-1',
    tenantId: 'tenant-1',
    userId: 'user-1',
    type: 'LEAVE_REQUEST_PENDING',
    message: 'A leave request needs review',
    read: false,
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        create: asyncMock(notification),
        findMany: asyncMock([notification]),
        findUnique: asyncMock(notification),
        update: asyncMock({ ...notification, read: true }),
        updateMany: asyncMock({ count: 1 }),
      },
      user: { findMany: asyncMock([{ id: 'user-1' }, { id: 'user-2' }]) },
    };
    queue = { add: asyncMock(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken(NOTIFICATIONS_QUEUE), useValue: queue },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('create', () => {
    it('never throws even when the write fails', async () => {
      prisma.notification.create.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.create('tenant-1', 'user-1', 'PAYROLL_DUE', 'msg'),
      ).resolves.toBeUndefined();
    });
  });

  describe('createForRoles', () => {
    it('creates a notification for every active user matching the given roles', async () => {
      await service.createForRoles(
        'tenant-1',
        [Role.ADMIN, Role.HR],
        'LEAVE_REQUEST_PENDING',
        'msg',
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          role: { in: [Role.ADMIN, Role.HR] },
          isActive: true,
        },
      });
      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('markRead', () => {
    it('marks a notification belonging to the requesting user as read', async () => {
      const result = await service.markRead('tenant-1', 'user-1', 'notif-1');

      expect(result.read).toBe(true);
      expect(prisma.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { read: true },
      });
    });

    it('throws NotFoundException when the notification belongs to a different user', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce({
        ...notification,
        userId: 'other-user',
      });

      await expect(
        service.markRead('tenant-1', 'user-1', 'notif-1'),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.notification.update).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the notification belongs to a different tenant', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce({
        ...notification,
        tenantId: 'other-tenant',
      });

      await expect(
        service.markRead('tenant-1', 'user-1', 'notif-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the notification does not exist', async () => {
      prisma.notification.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.markRead('tenant-1', 'user-1', 'missing'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAllRead', () => {
    it('marks all of the user unread notifications as read', async () => {
      await service.markAllRead('tenant-1', 'user-1');

      expect(prisma.notification.updateMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1', userId: 'user-1', read: false },
        data: { read: true },
      });
    });
  });

  describe('dispatch', () => {
    it('writes the in-app row and enqueues an EMAIL delivery job by default', async () => {
      await service.dispatch(
        'tenant-1',
        'user-1',
        'PAYROLL_RUN_COMPLETED',
        'msg',
      );

      expect(prisma.notification.create).toHaveBeenCalledTimes(1);
      expect(queue.add).toHaveBeenCalledWith(NOTIFICATION_DELIVER_JOB, {
        tenantId: 'tenant-1',
        userId: 'user-1',
        type: 'PAYROLL_RUN_COMPLETED',
        message: 'msg',
        metadata: undefined,
        channels: [NotificationChannel.EMAIL],
      });
    });

    it('never throws even when enqueueing fails', async () => {
      queue.add.mockRejectedValueOnce(new Error('redis down'));

      await expect(
        service.dispatch('tenant-1', 'user-1', 'PAYROLL_RUN_COMPLETED', 'msg'),
      ).resolves.toBeUndefined();
    });

    it('honors explicit channels and metadata', async () => {
      await service.dispatch('tenant-1', 'user-1', 'PAYROLL_RUN_COMPLETED', 'msg', {
        metadata: { runId: 'run-1' },
        channels: [NotificationChannel.SMS, NotificationChannel.PUSH],
      });

      expect(queue.add).toHaveBeenCalledWith(
        NOTIFICATION_DELIVER_JOB,
        expect.objectContaining({
          metadata: { runId: 'run-1' },
          channels: [NotificationChannel.SMS, NotificationChannel.PUSH],
        }),
      );
    });
  });

  describe('dispatchForRoles', () => {
    it('creates in-app rows and enqueues delivery for every active user matching the given roles', async () => {
      await service.dispatchForRoles(
        'tenant-1',
        [Role.ADMIN, Role.HR],
        'PAYROLL_RUN_COMPLETED',
        'msg',
      );

      expect(prisma.notification.create).toHaveBeenCalledTimes(2);
      expect(queue.add).toHaveBeenCalledTimes(2);
    });
  });
});
