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

const AUTHORIZE_URL = 'https://appcenter.intuit.com/connect/oauth2';
const TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const SCOPE = 'com.intuit.quickbooks.accounting';

interface JournalLine {
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

/**
 * QuickBooks Online, via Intuit's OAuth2 + REST API (v3). Both syncInvoice
 * and syncPayrollExpense post a balanced JournalEntry rather than a Sales
 * Invoice/Bill — a journal entry is the one QBO transaction type that
 * doesn't require a pre-existing Customer/Vendor/Item master record on the
 * tenant's side, which this integration has no way to know or create
 * correctly. Accounts referenced by name are looked up, or created on
 * first use, via the Account query/create endpoints.
 */
@Injectable()
export class QuickBooksAccountingProvider implements AccountingPlatformClient {
  readonly provider = AccountingProviderType.QUICKBOOKS;
  private readonly logger = new Logger(QuickBooksAccountingProvider.name);

  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  isConfigured(): boolean {
    const config = this.configService.get('accounting', {
      infer: true,
    }).quickbooks;
    return !!(config.clientId && config.clientSecret);
  }

  private apiBase(): string {
    const { environment } = this.configService.get('accounting', {
      infer: true,
    }).quickbooks;
    return environment === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com';
  }

  private redirectUri(): string {
    const apiPublicUrl = this.configService.get('apiPublicUrl', {
      infer: true,
    });
    return `${apiPublicUrl}/accounting/integrations/callback/QUICKBOOKS`;
  }

  getAuthorizeUrl(state: string): string {
    const config = this.configService.get('accounting', {
      infer: true,
    }).quickbooks;
    const params = new URLSearchParams({
      client_id: config.clientId ?? '',
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: SCOPE,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCodeForTokens(
    code: string,
    callbackParams: Record<string, string | undefined>,
  ): Promise<OAuthTokenResult> {
    const realmId = callbackParams.realmId;
    if (!realmId) {
      throw new Error('QuickBooks callback did not include a realmId');
    }
    const config = this.configService.get('accounting', {
      infer: true,
    }).quickbooks;

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

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      externalId: realmId,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResult> {
    const config = this.configService.get('accounting', {
      infer: true,
    }).quickbooks;
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
      // Only the tokens rotate on refresh — the caller already has the
      // realmId on file and keeps using it.
      externalId: '',
    };
  }

  private async resolveAccount(
    credentials: ResolvedAccountingCredentials,
    name: string,
    accountType: string,
  ): Promise<string> {
    const headers = {
      Authorization: `Bearer ${credentials.accessToken}`,
      Accept: 'application/json',
    };
    const query = `select * from Account where Name = '${name}'`;
    const found = await axios.get(
      `${this.apiBase()}/v3/company/${credentials.externalId}/query`,
      { headers, params: { query } },
    );
    const existing = found.data.QueryResponse?.Account?.[0];
    if (existing) return existing.Id as string;

    const created = await axios.post(
      `${this.apiBase()}/v3/company/${credentials.externalId}/account`,
      { Name: name, AccountType: accountType },
      { headers: { ...headers, 'Content-Type': 'application/json' } },
    );
    return created.data.Account.Id as string;
  }

  private async postJournalEntry(
    credentials: ResolvedAccountingCredentials,
    lines: JournalLine[],
  ): Promise<AccountingSyncResult> {
    try {
      const journalLines = await Promise.all(
        lines
          .filter((line) => line.debit > 0 || line.credit > 0)
          .map(async (line) => {
            const accountId = await this.resolveAccount(
              credentials,
              line.accountName,
              line.accountType,
            );
            return {
              Amount: line.debit || line.credit,
              DetailType: 'JournalEntryLineDetail',
              JournalEntryLineDetail: {
                PostingType: line.debit > 0 ? 'Debit' : 'Credit',
                AccountRef: { value: accountId },
              },
            };
          }),
      );

      const response = await axios.post(
        `${this.apiBase()}/v3/company/${credentials.externalId}/journalentry`,
        { Line: journalLines },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        },
      );
      return { success: true, externalId: response.data.JournalEntry?.Id };
    } catch (error) {
      this.logger.error(
        'Failed to post QuickBooks journal entry',
        error as Error,
      );
      return { success: false, error: (error as Error).message };
    }
  }

  syncInvoice(
    credentials: ResolvedAccountingCredentials,
    invoice: { amount: number },
  ): Promise<AccountingSyncResult> {
    return this.postJournalEntry(credentials, [
      {
        accountName: 'PayrollFiti Subscription Expense',
        accountType: 'Expense',
        debit: invoice.amount,
        credit: 0,
      },
      {
        accountName: 'Bank',
        accountType: 'Bank',
        debit: 0,
        credit: invoice.amount,
      },
    ]);
  }

  syncPayrollExpense(
    credentials: ResolvedAccountingCredentials,
    run: { totals: unknown },
  ): Promise<AccountingSyncResult> {
    const totals = parsePayrollTotals(run.totals);
    return this.postJournalEntry(credentials, [
      {
        accountName: 'Payroll Expense',
        accountType: 'Expense',
        debit: totals.grossPay,
        credit: 0,
      },
      {
        accountName: 'Payroll Liabilities',
        accountType: 'Other Current Liability',
        debit: 0,
        credit: totals.totalDeductions,
      },
      {
        accountName: 'Bank',
        accountType: 'Bank',
        debit: 0,
        credit: totals.netPay,
      },
    ]);
  }
}
