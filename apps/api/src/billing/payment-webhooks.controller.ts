import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Logger,
  Post,
  Query,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'node:crypto';
import { PaymentProviderType } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { AppConfig } from '../config/configuration';
import { BillingService } from './billing.service';

interface MpesaStkCallback {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
    };
  };
}

/**
 * Inbound payment confirmations. Both providers deliver the actual outcome
 * of a charge asynchronously — Paystack via a signed webhook, M-Pesa via an
 * unsigned STK push callback — so BillingService.payInvoice/charge() only
 * ever returns 'pending' for a real (non-stub) transaction. This is where
 * that gets resolved to PAID.
 */
@Controller('payment-webhooks')
export class PaymentWebhooksController {
  private readonly logger = new Logger(PaymentWebhooksController.name);

  constructor(
    private readonly billingService: BillingService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  @Public()
  @Post('paystack')
  @HttpCode(200)
  async paystack(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string | undefined,
  ) {
    const secretKey = this.configService.get('paystack', {
      infer: true,
    }).secretKey;
    if (!secretKey || !req.rawBody) {
      this.logger.warn(
        'Paystack webhook received but PAYSTACK_SECRET_KEY is not configured — ignoring',
      );
      return { received: false };
    }

    const expectedSignature = crypto
      .createHmac('sha512', secretKey)
      .update(req.rawBody)
      .digest('hex');

    if (!signature || !this.timingSafeEqualHex(signature, expectedSignature)) {
      this.logger.warn('Paystack webhook signature verification failed');
      return { received: false };
    }

    const event = JSON.parse(req.rawBody.toString('utf8'));
    const reference: string | undefined = event?.data?.reference;
    if (!reference) return { received: true };

    if (event.event === 'charge.success') {
      await this.billingService.confirmInvoicePaidByTransactionReference(
        PaymentProviderType.PAYSTACK,
        reference,
      );
    } else if (event.event === 'charge.failed') {
      await this.billingService.recordTransactionFailure(
        PaymentProviderType.PAYSTACK,
        reference,
      );
    }

    return { received: true };
  }

  @Public()
  @Post('mpesa')
  @HttpCode(200)
  async mpesa(
    @Body() body: MpesaStkCallback,
    @Query('token') token: string | undefined,
  ) {
    const expectedToken = this.configService.get('mpesa', {
      infer: true,
    }).callbackToken;
    if (expectedToken && token !== expectedToken) {
      this.logger.warn(
        'M-Pesa callback received with a missing or invalid token',
      );
      // Safaricom only cares that we ack with ResultCode 0; a mismatched
      // token means we simply drop the payload rather than process it.
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    const callback = body?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;

    if (checkoutRequestId) {
      if (callback?.ResultCode === 0) {
        await this.billingService.confirmInvoicePaidByTransactionReference(
          PaymentProviderType.MPESA,
          checkoutRequestId,
        );
      } else {
        await this.billingService.recordTransactionFailure(
          PaymentProviderType.MPESA,
          checkoutRequestId,
        );
      }
    }

    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  private timingSafeEqualHex(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  }
}
