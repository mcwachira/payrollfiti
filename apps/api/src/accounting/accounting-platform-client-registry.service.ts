import { Injectable } from '@nestjs/common';
import { AccountingProviderType } from '@prisma/client';
import { AccountingPlatformClient } from './accounting-platform-client.interface';
import { QuickBooksAccountingProvider } from './providers/quickbooks-accounting.provider';
import { XeroAccountingProvider } from './providers/xero-accounting.provider';
import { ZohoBooksAccountingProvider } from './providers/zoho-books-accounting.provider';

/** One place mapping AccountingProviderType -> its client, shared by the
 *  OAuth-flow service and the sync-time router so neither duplicates it. */
@Injectable()
export class AccountingPlatformClientRegistry {
  private readonly clients: Record<
    AccountingProviderType,
    AccountingPlatformClient
  >;

  constructor(
    quickbooks: QuickBooksAccountingProvider,
    xero: XeroAccountingProvider,
    zohoBooks: ZohoBooksAccountingProvider,
  ) {
    this.clients = {
      [AccountingProviderType.QUICKBOOKS]: quickbooks,
      [AccountingProviderType.XERO]: xero,
      [AccountingProviderType.ZOHO_BOOKS]: zohoBooks,
    };
  }

  get(provider: AccountingProviderType): AccountingPlatformClient {
    return this.clients[provider];
  }

  all(): AccountingPlatformClient[] {
    return Object.values(this.clients);
  }
}
