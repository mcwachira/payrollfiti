import { Module } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { StripeProvider } from './providers/stripe.provider';
import { MpesaProvider } from './providers/mpesa.provider';

@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeProvider, MpesaProvider],
  exports: [BillingService],
})
export class BillingModule {}
