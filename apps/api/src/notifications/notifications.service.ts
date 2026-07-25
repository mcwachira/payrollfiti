import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Notification, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

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
