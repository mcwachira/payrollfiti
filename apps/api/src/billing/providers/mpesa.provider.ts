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

const SANDBOX_BASE_URL = 'https://sandbox.safaricom.co.ke';
const PRODUCTION_BASE_URL = 'https://api.safaricom.co.ke';

/**
 * Daraja (M-Pesa) STK Push — Kenya's dominant mobile money rail. M-Pesa has
 * no native recurring-subscription concept, so createSubscription just
 * books a one-month period; actual collection happens per invoice via
 * charge(), which triggers an STK push prompt on the payer's phone.
 */
@Injectable()
export class MpesaProvider implements PaymentProvider {
  readonly type = PaymentProviderType.MPESA;
  private readonly logger = new Logger(MpesaProvider.name);
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService<AppConfig, true>) {
    this.baseUrl =
      this.configService.get('mpesa', { infer: true }).env === 'production'
        ? PRODUCTION_BASE_URL
        : SANDBOX_BASE_URL;
  }

  async createCustomer(customer: ProviderCustomer): Promise<string> {
    // M-Pesa has no customer object — the phone number supplied at charge time *is* the identity.
    return customer.tenantId;
  }

  async createSubscription(): Promise<ProviderSubscriptionResult> {
    const now = new Date();
    return {
      providerSubscriptionId: `mpesa-manual-${now.getTime()}`,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        now.getDate(),
      ),
    };
  }

  async charge(params: ChargeParams): Promise<ChargeResult> {
    const mpesaConfig = this.configService.get('mpesa', { infer: true });
    if (
      !mpesaConfig.consumerKey ||
      !mpesaConfig.consumerSecret ||
      !mpesaConfig.shortcode ||
      !mpesaConfig.passkey
    ) {
      this.logger.warn(
        'M-Pesa credentials not configured — simulating a successful STK push',
      );
      return {
        providerReference: `stub_mpesa_${params.reference}`,
        status: 'pending',
        raw: null,
      };
    }
    if (!params.phoneNumber) {
      throw new Error('M-Pesa charge requires a phoneNumber');
    }

    const accessToken = await this.getAccessToken(
      mpesaConfig.consumerKey,
      mpesaConfig.consumerSecret,
    );
    const timestamp = this.formatTimestamp(new Date());
    const password = Buffer.from(
      `${mpesaConfig.shortcode}${mpesaConfig.passkey}${timestamp}`,
    ).toString('base64');
    // Safaricom does not sign STK push callbacks, so a shared-secret token
    // is embedded in the callback URL itself to reject spoofed requests —
    // see payment-webhooks.controller.ts.
    const callbackUrl = mpesaConfig.callbackToken
      ? `${mpesaConfig.callbackUrl}?token=${encodeURIComponent(mpesaConfig.callbackToken)}`
      : mpesaConfig.callbackUrl;

    const response = await axios.post(
      `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: mpesaConfig.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: params.phoneNumber,
        PartyB: mpesaConfig.shortcode,
        PhoneNumber: params.phoneNumber,
        CallBackURL: callbackUrl,
        AccountReference: params.reference,
        TransactionDesc: params.reference,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    return {
      providerReference: response.data.CheckoutRequestID,
      status: response.data.ResponseCode === '0' ? 'pending' : 'failed',
      raw: response.data,
    };
  }

  private async getAccessToken(
    consumerKey: string,
    consumerSecret: string,
  ): Promise<string> {
    const credentials = Buffer.from(
      `${consumerKey}:${consumerSecret}`,
    ).toString('base64');
    const response = await axios.get(
      `${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        headers: { Authorization: `Basic ${credentials}` },
      },
    );
    return response.data.access_token;
  }

  private formatTimestamp(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }
}
