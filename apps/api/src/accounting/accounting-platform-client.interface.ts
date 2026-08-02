import { AccountingProviderType } from '@prisma/client';
import { AccountingSyncResult } from './accounting-provider.interface';

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  /** realmId (QuickBooks) / xero-tenant-id (Xero) / organization_id (Zoho Books). */
  externalId: string;
}

export interface ResolvedAccountingCredentials {
  accessToken: string;
  externalId: string;
}

/**
 * A stateless HTTP client for one accounting platform's OAuth2 + REST API.
 * Deliberately takes credentials as parameters rather than looking them up
 * itself (contrast WebPushProvider, which owns its own Prisma lookup) —
 * these are pure functions of (credentials, payload) so they're unit
 * testable without a database, and AccountingProviderRouter is the single
 * place that resolves which tenant's credentials to use.
 */
export interface AccountingPlatformClient {
  readonly provider: AccountingProviderType;

  /** False when this platform's CLIENT_ID/CLIENT_SECRET env vars aren't set. */
  isConfigured(): boolean;

  getAuthorizeUrl(state: string): string;

  /**
   * `callbackParams` is the OAuth redirect's full query string as a plain
   * object — QuickBooks returns `realmId` there directly; Xero and Zoho
   * Books require a follow-up API call after the token exchange instead,
   * which each implementation makes internally.
   */
  exchangeCodeForTokens(
    code: string,
    callbackParams: Record<string, string | undefined>,
  ): Promise<OAuthTokenResult>;

  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult>;

  syncInvoice(
    credentials: ResolvedAccountingCredentials,
    invoice: {
      id: string;
      tenantId: string;
      amount: number;
      currency: string;
      status: string;
    },
  ): Promise<AccountingSyncResult>;

  syncPayrollExpense(
    credentials: ResolvedAccountingCredentials,
    run: {
      id: string;
      tenantId: string;
      companyId: string;
      period: string;
      totals: unknown;
    },
  ): Promise<AccountingSyncResult>;
}
