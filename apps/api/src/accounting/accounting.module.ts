import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ACCOUNTING_PROVIDER } from './accounting-provider.interface';
import { AccountingProviderRouter } from './accounting-provider-router';
import { AccountingIntegrationsService } from './accounting-integrations.service';
import { AccountingIntegrationsController } from './accounting-integrations.controller';
import { AccountingPlatformClientRegistry } from './accounting-platform-client-registry.service';
import { QuickBooksAccountingProvider } from './providers/quickbooks-accounting.provider';
import { XeroAccountingProvider } from './providers/xero-accounting.provider';
import { ZohoBooksAccountingProvider } from './providers/zoho-books-accounting.provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AccountingIntegrationsController],
  providers: [
    QuickBooksAccountingProvider,
    XeroAccountingProvider,
    ZohoBooksAccountingProvider,
    AccountingPlatformClientRegistry,
    AccountingIntegrationsService,
    { provide: ACCOUNTING_PROVIDER, useClass: AccountingProviderRouter },
  ],
  exports: [ACCOUNTING_PROVIDER],
})
export class AccountingModule {}
