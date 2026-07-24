import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentProviderType } from '@prisma/client';
import { AppConfig } from '../../config/configuration';
import {
  ChargeParams,
  ChargeResult,
  PaymentProvider,
  ProviderCustomer,
  ProviderSubscriptionResult,
} from './payment-provider.interface';

@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly type = PaymentProviderType.STRIPE;
  private readonly logger = new Logger(StripeProvider.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    const secretKey = this.configService.get('stripe', {
      infer: true,
    }).secretKey;
    this.stripe = secretKey
      ? new Stripe(secretKey, { apiVersion: '2024-06-20' })
      : null;
  }

  async createCustomer(customer: ProviderCustomer): Promise<string> {
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — returning a stub customer id',
      );
      return `stub_cus_${customer.tenantId}`;
    }
    const created = await this.stripe.customers.create({
      name: customer.name,
      email: customer.email,
      metadata: { tenantId: customer.tenantId },
    });
    return created.id;
  }

  async createSubscription(params: {
    customerId: string;
    planPricePerEmployee: number;
    currency: string;
    quantity: number;
  }): Promise<ProviderSubscriptionResult> {
    if (!this.stripe) {
      const now = new Date();
      return {
        providerSubscriptionId: `stub_sub_${params.customerId}`,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          now.getDate(),
        ),
      };
    }

    const price = await this.stripe.prices.create({
      currency: params.currency.toLowerCase(),
      unit_amount: Math.round(params.planPricePerEmployee * 100),
      recurring: { interval: 'month' },
      product_data: { name: 'PayrollFiti seat' },
    });

    const subscription = await this.stripe.subscriptions.create({
      customer: params.customerId,
      items: [{ price: price.id, quantity: params.quantity }],
    });

    return {
      providerSubscriptionId: subscription.id,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
  }

  async charge(params: ChargeParams): Promise<ChargeResult> {
    if (!this.stripe) {
      this.logger.warn(
        'STRIPE_SECRET_KEY not set — simulating a successful charge',
      );
      return {
        providerReference: `stub_pi_${params.reference}`,
        status: 'succeeded',
        raw: null,
      };
    }

    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(params.amount * 100),
      currency: params.currency.toLowerCase(),
      customer: params.customerId,
      description: params.reference,
      confirm: false,
    });

    return {
      providerReference: paymentIntent.id,
      status: paymentIntent.status,
      raw: paymentIntent,
    };
  }
}
