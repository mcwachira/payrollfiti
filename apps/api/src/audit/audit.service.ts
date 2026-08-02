import { Injectable, Logger } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { redactSensitiveFields } from './redact-sensitive-fields';

export interface RecordAuditEntryInput {
  tenantId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
}

export type AuditLogWithActor = AuditLog & { actor: { email: string } | null };

export interface PaginatedAuditLogs {
  items: AuditLogWithActor[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: RecordAuditEntryInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorId: entry.actorId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          before: redactSensitiveFields(entry.before) ?? Prisma.JsonNull,
          after: redactSensitiveFields(entry.after) ?? Prisma.JsonNull,
          ipAddress: entry.ipAddress ?? null,
        },
      });
    } catch (error) {
      // Audit logging must never break the request it's observing.
      this.logger.error(
        `Failed to write audit log for ${entry.entityType}:${entry.entityId}`,
        error as Error,
      );
    }
  }

  async list(
    tenantId: string,
    query: ListAuditLogsQueryDto,
  ): Promise<PaginatedAuditLogs> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const where: Prisma.AuditLogWhereInput = {
      tenantId,
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.action
        ? { action: { contains: query.action, mode: 'insensitive' } }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { actor: { select: { email: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
