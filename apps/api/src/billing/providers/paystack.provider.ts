import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PaymentProviderType } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import {
  ChargeParams,
  ChargeResult,
  PaymentProvider,
  ProviderCustomer,
  ProviderSubscriptionResult,
} from './payment-provider.interface';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

/**
 * Paystack — card/bank rails across Nigeria, South Africa, Kenya, and Ghana.
 * Paystack subscriptions require an existing card authorization (obtained
 * from a prior successful transaction), which we don't have at signup time,
 * so createSubscription just books a local period like MpesaProvider does —
 * actual collection happens per invoice via charge(), which initializes a
 * hosted-checkout transaction and returns an authorization_url for the
 * frontend to redirect the payer to. Confirmation arrives asynchronously via
 * the `charge.success` webhook (see payment-webhooks.controller.ts), not
 * from this call's response.
 */
@Injectable()
export class PaystackProvider implements PaymentProvider {
  readonly type = PaymentProviderType.PAYSTACK;
  private readonly logger = new Logger(PaystackProvider.name);
  private readonly secretKey: string | undefined;
  private readonly callbackBaseUrl: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.secretKey = this.configService.get('paystack', {
      infer: true,
    }).secretKey;
    this.callbackBaseUrl = this.configService.get('corsOrigin', {
      infer: true,
    });
  }

  async createCustomer(customer: ProviderCustomer): Promise<string> {
    if (!this.secretKey) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY not set — returning a stub customer id',
      );
      return `stub_cus_${customer.tenantId}`;
    }
    const [firstName, ...rest] = customer.name.split(' ');
    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/customer`,
      {
        email: customer.email,
        first_name: firstName || customer.name,
        last_name: rest.join(' ') || customer.name,
      },
      { headers: this.authHeaders() },
    );
    return response.data.data.customer_code;
  }

  async createSubscription(): Promise<ProviderSubscriptionResult> {
    const now = new Date();
    return {
      providerSubscriptionId: `paystack-manual-${now.getTime()}`,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
      ),
    };
  }

  async charge(params: ChargeParams): Promise<ChargeResult> {
    if (!this.secretKey) {
      this.logger.warn(
        'PAYSTACK_SECRET_KEY not set — simulating a successful charge',
      );
      return {
        providerReference: `stub_paystack_${params.reference}`,
        status: 'succeeded',
        raw: null,
      };
    }
    if (!params.email) {
      throw new Error('Paystack charge requires an email');
    }

    const response = await axios.post(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        email: params.email,
        amount: Math.round(params.amount * 100),
        currency: params.currency,
        reference: params.reference,
        callback_url: `${this.callbackBaseUrl}/billing`,
      },
      { headers: this.authHeaders() },
    );

    return {
      providerReference: response.data.data.reference,
      status: 'pending',
      raw: response.data.data,
    };
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.secretKey}` };
  }
}
