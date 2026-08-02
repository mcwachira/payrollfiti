import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingCycleService } from './billing-cycle.service';
import { BillingController } from './billing.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { PaystackProvider } from './providers/paystack.provider';
import { MpesaProvider } from './providers/mpesa.provider';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [WebhooksModule, AccountingModule],
  controllers: [BillingController, PaymentWebhooksController],
  providers: [
    BillingService,
    BillingCycleService,
    PaystackProvider,
    MpesaProvider,
  ],
  exports: [BillingService],
})
export class BillingModule {}
