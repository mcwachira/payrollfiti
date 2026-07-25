import { randomBytes, createHash } from 'crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { ApiKey } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hashing choice: SHA-256, NOT bcrypt. API keys are high-entropy
   * machine-generated tokens (32 random bytes) rather than low-entropy
   * user-chosen passwords, so there is no dictionary/brute-force risk that
   * bcrypt's deliberate slowness defends against here — a fast one-way hash
   * is sufficient and avoids needless per-request CPU overhead on every
   * public-api call.
   */
  async create(
    tenantId: string,
    actorId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const rawKey = `pfk_${randomBytes(24).toString('hex')}`;
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 12);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        hashedKey,
        keyPrefix,
        createdById: actorId,
      },
    });

    // rawKey is returned ONLY in this response — it is never retrievable
    // again after this call (only its SHA-256 hash is persisted).
    return { apiKey, rawKey };
  }

  list(tenantId: string): Promise<Omit<ApiKey, 'hashedKey'>[]> {
    return this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      // Explicitly select every column except hashedKey — never select it
      // for a list response.
      select: {
        id: true,
        tenantId: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdById: true,
        createdAt: true,
      },
    });
  }

  async revoke(tenantId: string, id: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey || apiKey.tenantId !== tenantId) {
      throw new NotFoundException('API key not found');
    }
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  async validate(rawKey: string): Promise<{ tenantId: string } | null> {
    const hashedKey = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.apiKey.findFirst({
      where: { hashedKey, revokedAt: null },
    });
    if (!apiKey) return null;

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { tenantId: apiKey.tenantId };
  }
}
