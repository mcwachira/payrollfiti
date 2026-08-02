import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const SCOPE = 'ZohoBooks.fullaccess.all';

interface JournalLine {
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

/**
 * Zoho Books, via its OAuth2 + REST API (v3). Zoho's accounts/API hosts are
 * region-specific (accounts.zoho.com vs .eu/.in/.com.au/.jp — ZOHO_BOOKS_REGION),
 * unlike QuickBooks/Xero which have one global host. organization_id (this
 * codebase's externalId) comes from a follow-up call after the token
 * exchange, same reason as Xero's tenantId.
 */
@Injectable()
export class ZohoBooksAccountingProvider implements AccountingPlatformClient {
  readonly provider = AccountingProviderType.ZOHO_BOOKS;
  private readonly logger = new Logger(ZohoBooksAccountingProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  isConfigured(): boolean {
    const config = this.configService.get('accounting', {
      infer: true,
    }).zohoBooks;
    return !!(config.clientId && config.clientSecret);
  }

  private region(): string {
    return this.configService.get('accounting', { infer: true }).zohoBooks
      .region;
  }

  private accountsBase(): string {
    return `https://accounts.zoho.${this.region()}`;
  }

  private apiBase(): string {
    return `https://www.zohoapis.${this.region()}/books/v3`;
  }

  private redirectUri(): string {
    const apiPublicUrl = this.configService.get('apiPublicUrl', {
      infer: true,
    });
    return `${apiPublicUrl}/accounting/integrations/callback/ZOHO_BOOKS`;
  }

  getAuthorizeUrl(state: string): string {
    const config = this.configService.get('accounting', {
      infer: true,
    }).zohoBooks;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId ?? '',
      redirect_uri: this.redirectUri(),
      scope: SCOPE,
      access_type: 'offline',
      state,
    });
    return `${this.accountsBase()}/oauth/v2/auth?${params.toString()}`;
  }

  private async fetchOrganizationId(accessToken: string): Promise<string> {
    const response = await axios.get(`${this.apiBase()}/organizations`, {
      headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
    });
    const organization = response.data?.organizations?.[0];
    if (!organization?.organization_id) {
      throw new Error(
        'Zoho Books returned no organization for this authorization',
      );
    }
    return organization.organization_id as string;
  }

  // callbackParams is part of AccountingPlatformClient's shared signature —
  // unused here since Zoho's organization_id comes from a follow-up call
  // (fetchOrganizationId), not the callback query string.
  async exchangeCodeForTokens(
    code: string,
    callbackParams: Record<string, string | undefined>,
  ): Promise<OAuthTokenResult> {
    void callbackParams;
    const config = this.configService.get('accounting', {
      infer: true,
    }).zohoBooks;
    const response = await axios.post(
      `${this.accountsBase()}/oauth/v2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId ?? '',
        client_secret: config.clientSecret ?? '',
        redirect_uri: this.redirectUri(),
        code,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const externalId = await this.fetchOrganizationId(
      response.data.access_token,
    );
    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      externalId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
    const config = this.configService.get('accounting', {
      infer: true,
    }).zohoBooks;
    const response = await axios.post(
      `${this.accountsBase()}/oauth/v2/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.clientId ?? '',
        client_secret: config.clientSecret ?? '',
        refresh_token: refreshToken,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    return {
      accessToken: response.data.access_token,
      // Zoho's refresh grant doesn't return a new refresh_token — the
      // original keeps working until the user revokes access.
      refreshToken,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      externalId: '', // caller already has the organization_id on file
    };
  }

  private async resolveAccountId(
    credentials: ResolvedAccountingCredentials,
    name: string,
    accountType: string,
  ): Promise<string> {
    const headers = {
      Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
    };
    const found = await axios.get(`${this.apiBase()}/chartofaccounts`, {
      headers,
      params: { organization_id: credentials.externalId, account_name: name },
    });
    const existing = found.data.chartofaccounts?.[0];
    if (existing) return existing.account_id as string;

    const created = await axios.post(
      `${this.apiBase()}/chartofaccounts`,
      { account_name: name, account_type: accountType },
      { headers, params: { organization_id: credentials.externalId } },
    );
    return created.data.chart_of_account.account_id as string;
  }

  private async postJournal(
    credentials: ResolvedAccountingCredentials,
    notes: string,
    lines: JournalLine[],
  ): Promise<AccountingSyncResult> {
    try {
      const lineItems = await Promise.all(
        lines
          .filter((line) => line.debit > 0 || line.credit > 0)
          .map(async (line) => ({
            account_id: await this.resolveAccountId(
              credentials,
              line.accountName,
              line.accountType,
            ),
            debit_or_credit: line.debit > 0 ? 'debit' : 'credit',
            amount: line.debit || line.credit,
          })),
      );

      const response = await axios.post(
        `${this.apiBase()}/journals`,
        {
          journal_date: new Date().toISOString().slice(0, 10),
          notes,
          line_items: lineItems,
        },
        {
          headers: {
            Authorization: `Zoho-oauthtoken ${credentials.accessToken}`,
          },
          params: { organization_id: credentials.externalId },
        },
      );
      return { success: true, externalId: response.data.journal?.journal_id };
    } catch (error) {
      this.logger.error('Failed to post Zoho Books journal', error as Error);
      return { success: false, error: (error as Error).message };
    }
  }

  syncInvoice(
    credentials: ResolvedAccountingCredentials,
    invoice: { amount: number },
  ): Promise<AccountingSyncResult> {
    return this.postJournal(credentials, 'PayrollFiti subscription payment', [
      {
        accountName: 'PayrollFiti Subscription Expense',
        accountType: 'expense',
        debit: invoice.amount,
        credit: 0,
      },
      {
        accountName: 'Bank',
        accountType: 'cash',
        debit: 0,
        credit: invoice.amount,
      },
    ]);
  }

  syncPayrollExpense(
    credentials: ResolvedAccountingCredentials,
    run: { period: string; totals: unknown },
  ): Promise<AccountingSyncResult> {
    const totals = parsePayrollTotals(run.totals);
    return this.postJournal(credentials, `Payroll run ${run.period}`, [
      {
        accountName: 'Payroll Expense',
        accountType: 'expense',
        debit: totals.grossPay,
        credit: 0,
      },
      {
        accountName: 'Payroll Liabilities',
        accountType: 'other_current_liability',
        debit: 0,
        credit: totals.totalDeductions,
      },
      {
        accountName: 'Bank',
        accountType: 'cash',
        debit: 0,
        credit: totals.netPay,
      },
    ]);
  }
}
