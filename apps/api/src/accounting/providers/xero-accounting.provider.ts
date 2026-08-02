import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import axios from 'axios';
import { AccountingProviderType } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import { AccountingSyncResult } from '../accounting-provider.interface';
import {
  AccountingPlatformClient,
  OAuthTokenResult,
  ResolvedAccountingCredentials,
} from '../accounting-platform-client.interface';
import { parsePayrollTotals } from '../payroll-totals';

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.xro/2.0';
const SCOPE = 'offline_access accounting.transactions accounting.settings';

interface JournalLine {
  accountName: string;
  /** Signed — Xero's ManualJournal lines use one amount, not separate debit/credit fields. */
  amount: number;
}

/**
 * Xero, via its OAuth2 + Accounting API (2.0). Unlike QuickBooks, the org
 * identifier ("xero-tenant-id" — a different concept from this codebase's
 * own Tenant) isn't returned by the token exchange; it comes from a
 * follow-up call to /connections. Manual journal lines reference accounts
 * by Code (a short string the tenant's chart of accounts assigns), so
 * accounts are looked up/created with a deterministic generated code.
 */
@Injectable()
export class XeroAccountingProvider implements AccountingPlatformClient {
  readonly provider = AccountingProviderType.XERO;
  private readonly logger = new Logger(XeroAccountingProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  isConfigured(): boolean {
    const config = this.configService.get('accounting', { infer: true }).xero;
    return !!(config.clientId && config.clientSecret);
  }

  private redirectUri(): string {
    const apiPublicUrl = this.configService.get('apiPublicUrl', {
      infer: true,
    });
    return `${apiPublicUrl}/accounting/integrations/callback/XERO`;
  }

  getAuthorizeUrl(state: string): string {
    const config = this.configService.get('accounting', { infer: true }).xero;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId ?? '',
      redirect_uri: this.redirectUri(),
      scope: SCOPE,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  private async fetchTenantId(accessToken: string): Promise<string> {
    const response = await axios.get(CONNECTIONS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    const connection = response.data?.[0];
    if (!connection?.tenantId) {
      throw new Error(
        'Xero returned no connected organisation for this authorization',
      );
    }
    return connection.tenantId as string;
  }

  // callbackParams is part of AccountingPlatformClient's shared signature —
  // unused here since Xero's org identifier comes from /connections
  // (fetchTenantId), not the callback query string like QuickBooks' realmId.
  async exchangeCodeForTokens(
    code: string,
    callbackParams: Record<string, string | undefined>,
  ): Promise<OAuthTokenResult> {
    void callbackParams;
    const config = this.configService.get('accounting', { infer: true }).xero;
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri(),
      }),
      {
        auth: {
          username: config.clientId ?? '',
          password: config.clientSecret ?? '',
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      },
    );

    const externalId = await this.fetchTenantId(response.data.access_token);
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      externalId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
    const config = this.configService.get('accounting', { infer: true }).xero;
    const response = await axios.post(
      TOKEN_URL,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        auth: {
          username: config.clientId ?? '',
          password: config.clientSecret ?? '',
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      },
    );
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      externalId: '', // caller already has the xero-tenant-id on file
    };
  }

  /** Deterministic 4-digit code so the same account name always resolves to the same Code. */
  private codeFor(name: string): string {
    const hash = createHash('sha256').update(name).digest();
    return String(1000 + (hash.readUInt16BE(0) % 9000));
  }

  private async resolveAccountCode(
    credentials: ResolvedAccountingCredentials,
    name: string,
    accountType: string,
  ): Promise<string> {
    const headers = {
      Authorization: `Bearer ${credentials.accessToken}`,
      'xero-tenant-id': credentials.externalId,
      Accept: 'application/json',
    };
    const found = await axios.get(`${API_BASE}/Accounts`, {
      headers,
      params: { where: `Name=="${name}"` },
    });
    const existing = found.data.Accounts?.[0];
    if (existing) return existing.Code as string;

    const code = this.codeFor(name);
    const created = await axios.put(
      `${API_BASE}/Accounts`,
      { Code: code, Name: name, Type: accountType },
      { headers: { ...headers, 'Content-Type': 'application/json' } },
    );
    return (created.data.Accounts?.[0]?.Code as string) ?? code;
  }

  private async postManualJournal(
    credentials: ResolvedAccountingCredentials,
    narration: string,
    lines: JournalLine[],
  ): Promise<AccountingSyncResult> {
    try {
      const journalLines = await Promise.all(
        lines
          .filter((line) => line.amount !== 0)
          .map(async (line) => ({
            LineAmount: line.amount,
            AccountCode: await this.resolveAccountCode(
              credentials,
              line.accountName,
              line.amount > 0 ? 'EXPENSE' : 'BANK',
            ),
          })),
      );

      const response = await axios.post(
        `${API_BASE}/ManualJournals`,
        {
          ManualJournals: [
            { Narration: narration, JournalLines: journalLines },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'xero-tenant-id': credentials.externalId,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );
      return {
        success: true,
        externalId: response.data.ManualJournals?.[0]?.ManualJournalID,
      };
    } catch (error) {
      this.logger.error('Failed to post Xero manual journal', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  syncInvoice(
    credentials: ResolvedAccountingCredentials,
    invoice: { amount: number },
  ): Promise<AccountingSyncResult> {
    // Positive = debit, negative = credit — Xero's manual journal lines net
    // to zero across the set rather than using separate debit/credit fields.
    return this.postManualJournal(
      credentials,
      'PayrollFiti subscription payment',
      [
        {
          accountName: 'PayrollFiti Subscription Expense',
          amount: invoice.amount,
        },
        { accountName: 'Bank', amount: -invoice.amount },
      ],
    );
  }

  syncPayrollExpense(
    credentials: ResolvedAccountingCredentials,
    run: { period: string; totals: unknown },
  ): Promise<AccountingSyncResult> {
    const totals = parsePayrollTotals(run.totals);
    return this.postManualJournal(credentials, `Payroll run ${run.period}`, [
      { accountName: 'Payroll Expense', amount: totals.grossPay },
      { accountName: 'Payroll Liabilities', amount: -totals.totalDeductions },
      { accountName: 'Bank', amount: -totals.netPay },
    ]);
  }
}
