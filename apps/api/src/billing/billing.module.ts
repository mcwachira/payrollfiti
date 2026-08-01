import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingCycleService } from './billing-cycle.service';
import { BillingController } from './billing.controller';
import { StripeProvider } from './providers/stripe.provider';
import { MpesaProvider } from './providers/mpesa.provider';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [WebhooksModule, AccountingModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingCycleService,
    StripeProvider,
    MpesaProvider,
  ],
  exports: [BillingService],
})
export class BillingModule {}
