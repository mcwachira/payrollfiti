import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AccountingProviderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { AppConfig } from '../config/configuration';
import { AccountingPlatformClientRegistry } from './accounting-platform-client-registry.service';

const STATE_PURPOSE = 'accounting-oauth-state';
const STATE_EXPIRES_IN = '10m';

interface OAuthStatePayload {
  purpose: typeof STATE_PURPOSE;
  tenantId: string;
  userId: string;
  provider: AccountingProviderType;
}

export interface AccountingIntegrationStatus {
  provider: AccountingProviderType;
  configured: boolean;
  connected: boolean;
  connectedAt: Date | null;
}

/**
 * Owns the OAuth2 dance and encrypted token storage for accounting
 * integrations — separate from AccountingProviderRouter, which only reads
 * what this writes at sync time. Reuses JwtService (already wired for
 * access/refresh tokens) to sign the `state` param: a short-lived,
 * purpose-tagged token rather than a new table, mirroring how this
 * codebase already treats JWTs as a general "prove this request is ours
 * and hasn't been tampered with" tool, not just a session mechanism.
 */
@Injectable()
export class AccountingIntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly registry: AccountingPlatformClientRegistry,
  ) {}

  async listStatus(tenantId: string): Promise<AccountingIntegrationStatus[]> {
    const integration = await this.prisma.accountingIntegration.findUnique({
      where: { tenantId },
    });
    return this.registry.all().map((client) => ({
      provider: client.provider,
      configured: client.isConfigured(),
      connected: integration?.provider === client.provider,
      connectedAt:
        integration?.provider === client.provider
          ? integration.createdAt
          : null,
    }));
  }

  async getAuthorizeUrl(
    tenantId: string,
    userId: string,
    provider: AccountingProviderType,
  ): Promise<string> {
    const client = this.registry.get(provider);
    if (!client.isConfigured()) {
      throw new BadRequestException(
        `${provider} is not configured on this server — set its CLIENT_ID/CLIENT_SECRET env vars first`,
      );
    }

    const state = await this.jwtService.signAsync(
      {
        purpose: STATE_PURPOSE,
        tenantId,
        userId,
        provider,
      } satisfies OAuthStatePayload,
      {
        secret: this.configService.get('jwt', { infer: true }).accessSecret,
        expiresIn: STATE_EXPIRES_IN,
      },
    );
    return client.getAuthorizeUrl(state);
  }

  /**
   * Redeems the OAuth callback. `provider` is the path param the platform
   * redirected to; it's cross-checked against the provider embedded in
   * `state` so a tampered path segment can't attach the wrong provider's
   * tokens to a connection.
   */
  async handleCallback(
    provider: AccountingProviderType,
    code: string,
    state: string,
    callbackParams: Record<string, string | undefined>,
  ): Promise<void> {
    let payload: OAuthStatePayload;
    try {
      payload = await this.jwtService.verifyAsync<OAuthStatePayload>(state, {
        secret: this.configService.get('jwt', { infer: true }).accessSecret,
      });
    } catch {
      throw new UnauthorizedException(
        'This authorization link is invalid or has expired',
      );
    }
    if (payload.purpose !== STATE_PURPOSE || payload.provider !== provider) {
      throw new UnauthorizedException(
        'This authorization link is invalid or has expired',
      );
    }

    const client = this.registry.get(provider);
    const tokens = await client.exchangeCodeForTokens(code, callbackParams);

    await this.prisma.accountingIntegration.upsert({
      where: { tenantId: payload.tenantId },
      create: {
        tenantId: payload.tenantId,
        provider,
        externalId: tokens.externalId,
        accessTokenEncrypted: this.encryptionService.encrypt(
          tokens.accessToken,
        )!,
        refreshTokenEncrypted: this.encryptionService.encrypt(
          tokens.refreshToken,
        )!,
        expiresAt: tokens.expiresAt,
        connectedById: payload.userId,
      },
      update: {
        provider,
        externalId: tokens.externalId,
        accessTokenEncrypted: this.encryptionService.encrypt(
          tokens.accessToken,
        )!,
        refreshTokenEncrypted: this.encryptionService.encrypt(
          tokens.refreshToken,
        )!,
        expiresAt: tokens.expiresAt,
        connectedById: payload.userId,
      },
    });
  }

  async disconnect(
    tenantId: string,
    provider: AccountingProviderType,
  ): Promise<void> {
    const integration = await this.prisma.accountingIntegration.findUnique({
      where: { tenantId },
    });
    if (!integration || integration.provider !== provider) {
      throw new NotFoundException(
        `No connected ${provider} integration for this tenant`,
      );
    }
    await this.prisma.accountingIntegration.delete({ where: { tenantId } });
  }
}
