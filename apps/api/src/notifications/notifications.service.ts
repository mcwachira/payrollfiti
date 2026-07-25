import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationChannel } from './notification-channel.enum';
import {
  NOTIFICATION_DELIVER_JOB,
  NOTIFICATIONS_QUEUE,
  NotificationDeliverJobData,
} from './notifications.queue';

export interface DispatchOptions {
  metadata?: Record<string, unknown>;
  /** Out-of-band channels to fan out to, in addition to the in-app row this always writes. Defaults to EMAIL. */
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly queue: Queue<NotificationDeliverJobData>,
  ) {}

  /**
   * Best-effort, never-throw, logged — mirrors AuditService.record. A
   * notification failing to write must never break the request that
   * triggered it (a payroll run completing, a leave decision, etc.).
   */
  async create(
    tenantId: string,
    userId: string,
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          tenantId,
          userId,
          type,
          message,
          metadata: (metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create notification (${type}) for user ${userId}`,
        error as Error,
      );
    }
  }

  async createForRoles(
    tenantId: string,
    roles: Role[],
    type: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { tenantId, role: { in: roles }, isActive: true },
      });
      for (const user of users) {
        await this.create(tenantId, user.id, type, message, metadata);
      }
    } catch (error) {
      this.logger.error(
        `Failed to create notifications for roles (${roles.join(', ')}) in tenant ${tenantId}`,
        error as Error,
      );
    }
  }

  /**
   * Writes the in-app row (as `create` does) and additionally enqueues a
   * BullMQ job to fan out to the requested out-of-band channels
   * (email/SMS/push), off the request thread and with retry — the
   * multi-channel counterpart to `create`.
   */
  async dispatch(
    tenantId: string,
    userId: string,
    type: string,
    message: string,
    options?: DispatchOptions,
  ): Promise<void> {
    await this.create(tenantId, userId, type, message, options?.metadata);
    await this.enqueueDelivery(tenantId, userId, type, message, options);
  }

  /**
   * The multi-channel counterpart to `createForRoles`. Resolves the
   * matching users once and reuses that list for both the in-app row and
   * the delivery job, rather than looking them up twice.
   */
  async dispatchForRoles(
    tenantId: string,
    roles: Role[],
    type: string,
    message: string,
    options?: DispatchOptions,
  ): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { tenantId, role: { in: roles }, isActive: true },
      });
      for (const user of users) {
        await this.create(tenantId, user.id, type, message, options?.metadata);
        await this.enqueueDelivery(tenantId, user.id, type, message, options);
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch notifications for roles (${roles.join(', ')}) in tenant ${tenantId}`,
        error as Error,
      );
    }
  }

  /**
   * Best-effort, never-throw, logged — a failure to enqueue delivery must
   * never break the request that triggered it. The in-app row (already
   * written by this point) is unaffected either way.
   */
  private async enqueueDelivery(
    tenantId: string,
    userId: string,
    type: string,
    message: string,
    options?: DispatchOptions,
  ): Promise<void> {
    try {
      await this.queue.add(NOTIFICATION_DELIVER_JOB, {
        tenantId,
        userId,
        type,
        message,
        metadata: options?.metadata,
        channels: options?.channels ?? [NotificationChannel.EMAIL],
      });
    } catch (error) {
      this.logger.error(
        `Failed to enqueue notification delivery (${type}) for user ${userId}`,
        error as Error,
      );
    }
  }

  async listForUser(
    tenantId: string,
    userId: string,
    unreadOnly = false,
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(
    tenantId: string,
    userId: string,
    id: string,
  ): Promise<Notification> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (
      !notification ||
      notification.tenantId !== tenantId ||
      notification.userId !== userId
    ) {
      throw new NotFoundException('Notification not found');
    }
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { tenantId, userId, read: false },
      data: { read: true },
    });
  }
}
