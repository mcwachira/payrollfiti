import { Injectable } from '@nestjs/common';
import {
  AccountingProvider,
  AccountingSyncResult,
} from '../accounting-provider.interface';

/** Default provider: trivially succeeds without doing any real I/O. */
@Injectable()
export class NoopAccountingProvider implements AccountingProvider {
  readonly name = 'noop';

  async syncInvoice(): Promise<AccountingSyncResult> {
    return { success: true };
  }

  async syncPayrollExpense(): Promise<AccountingSyncResult> {
    return { success: true };
  }
}
