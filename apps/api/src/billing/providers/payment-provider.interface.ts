import { PaymentProviderType } from '@prisma/client';

export interface ProviderCustomer {
  tenantId: string;
  name: string;
  email: string;
}

export interface ProviderSubscriptionResult {
  providerSubscriptionId: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export interface ChargeParams {
  amount: number;
  currency: string;
  reference: string;
  customerId?: string;
  /** Required by phone-based providers like M-Pesa */
  phoneNumber?: string;
  /** Required by hosted-checkout providers like Paystack */
  email?: string;
}

export interface ChargeResult {
  providerReference: string;
  status: string;
  raw: unknown;
}

/**
 * Every payment/billing provider (card/bank rails via Paystack, local mobile
 * money via M-Pesa, future providers) implements this so BillingService never
 * has to branch on which provider a tenant picked.
 */
export interface PaymentProvider {
  readonly type: PaymentProviderType;
  createCustomer(customer: ProviderCustomer): Promise<string>;
  createSubscription(params: {
    customerId: string;
    planPricePerEmployee: number;
    currency: string;
    quantity: number;
  }): Promise<ProviderSubscriptionResult>;
  charge(params: ChargeParams): Promise<ChargeResult>;
}

export const PAYMENT_PROVIDERS = 'PAYMENT_PROVIDERS';
