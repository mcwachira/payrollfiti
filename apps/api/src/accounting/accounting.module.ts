import { Module } from '@nestjs/common';
import { ACCOUNTING_PROVIDER } from './accounting-provider.interface';
import { NoopAccountingProvider } from './providers/noop-accounting.provider';

@Module({
  providers: [
    { provide: ACCOUNTING_PROVIDER, useClass: NoopAccountingProvider },
  ],
  exports: [ACCOUNTING_PROVIDER],
})
export class AccountingModule {}
