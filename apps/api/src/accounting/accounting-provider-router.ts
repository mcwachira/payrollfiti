import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/crypto/encryption.service';
import { AccountingPlatformClientRegistry } from './accounting-platform-client-registry.service';
import {
  AccountingProvider,
  AccountingSyncResult,
} from './accounting-provider.interface';
import { ResolvedAccountingCredentials } from './accounting-platform-client.interface';

/** A token is refreshed this far ahead of its recorded expiry, rather than
 *  waiting for a sync call to hit an already-expired token and fail. */
const REFRESH_SKEW_MS = 2 * 60 * 1000;

/**
 * The single AccountingProvider bound to ACCOUNTING_PROVIDER — everything
 * BillingService/PayrollService already call is unchanged; this router is
 * what makes "one global provider" become "whichever provider this tenant
 * connected, using their own OAuth tokens", entirely behind the same
 * interface NoopAccountingProvider used to satisfy.
 */
@Injectable()
export class AccountingProviderRouter implements AccountingProvider {
  readonly name = 'accounting-provider-router';
  private readonly logger = new Logger(AccountingProviderRouter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly registry: AccountingPlatformClientRegistry,
  ) {}

  private async resolveCredentials(tenantId: string): Promise<{
    client: ReturnType<AccountingPlatformClientRegistry['get']>;
    credentials: ResolvedAccountingCredentials;
  } | null> {
    const integration = await this.prisma.accountingIntegration.findUnique({
      where: { tenantId },
    });
    if (!integration) return null;

    const client = this.registry.get(integration.provider);
    const accessToken = this.encryptionService.decrypt(
      integration.accessTokenEncrypted,
    )!;
    const refreshToken = this.encryptionService.decrypt(
      integration.refreshTokenEncrypted,
    )!;

    if (integration.expiresAt.getTime() - REFRESH_SKEW_MS > Date.now()) {
      return {
        client,
        credentials: { accessToken, externalId: integration.externalId },
      };
    }

    try {
      const refreshed = await client.refreshAccessToken(refreshToken);
      await this.prisma.accountingIntegration.update({
        where: { tenantId },
        data: {
          accessTokenEncrypted: this.encryptionService.encrypt(
            refreshed.accessToken,
          )!,
          refreshTokenEncrypted: this.encryptionService.encrypt(
            refreshed.refreshToken,
          )!,
          expiresAt: refreshed.expiresAt,
        },
      });
      return {
        client,
        credentials: {
          accessToken: refreshed.accessToken,
          externalId: integration.externalId,
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to refresh ${integration.provider} access token for tenant ${tenantId}`,
        error as Error,
      );
      return null;
    }
  }

  async syncInvoice(invoice: {
    id: string;
    tenantId: string;
    amount: number;
    currency: string;
    status: string;
  }): Promise<AccountingSyncResult> {
    const resolved = await this.resolveCredentials(invoice.tenantId);
    if (!resolved) {
      return {
        success: false,
        error: 'No accounting integration connected for this tenant',
      };
    }
    return resolved.client.syncInvoice(resolved.credentials, invoice);
  }

  async syncPayrollExpense(run: {
    id: string;
    tenantId: string;
    companyId: string;
    period: string;
    totals: unknown;
  }): Promise<AccountingSyncResult> {
    const resolved = await this.resolveCredentials(run.tenantId);
    if (!resolved) {
      return {
        success: false,
        error: 'No accounting integration connected for this tenant',
      };
    }
    return resolved.client.syncPayrollExpense(resolved.credentials, run);
  }
}
