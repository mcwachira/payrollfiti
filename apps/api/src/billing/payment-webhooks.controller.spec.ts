import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as crypto from 'node:crypto';
import { PaymentProviderType } from '@prisma/client';
import { PaymentWebhooksController } from './payment-webhooks.controller';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('PaymentWebhooksController', () => {
  let controller: PaymentWebhooksController;
  let billingService: any;
  let configService: { get: jest.Mock<(...args: any[]) => any> };

  const secretKey = 'sk_test_webhook_secret';

  beforeEach(() => {
    billingService = {
      confirmInvoicePaidByTransactionReference: asyncMock(null),
      recordTransactionFailure: asyncMock(undefined),
    };
    configService = {
      get: jest.fn<(key: string) => any>((key: string) => {
        if (key === 'paystack') return { secretKey };
        if (key === 'mpesa') return { callbackToken: 'shared-secret' };
        return undefined;
      }),
    };
    controller = new PaymentWebhooksController(
      billingService,
      configService as any,
    );
  });

  function signedRequest(payload: object) {
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = crypto
      .createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex');
    return { rawBody, signature };
  }

  describe('paystack', () => {
    it('rejects a request with an invalid signature', async () => {
      const { rawBody } = signedRequest({
        event: 'charge.success',
        data: { reference: 'invoice-1' },
      });

      const result = await controller.paystack(
        { rawBody } as any,
        'not-the-real-signature',
      );

      expect(result).toEqual({ received: false });
      expect(
        billingService.confirmInvoicePaidByTransactionReference,
      ).not.toHaveBeenCalled();
    });

    it('ignores the webhook when PAYSTACK_SECRET_KEY is not configured', async () => {
      configService.get.mockImplementation((key: string) =>
        key === 'paystack' ? {} : undefined,
      );
      const { rawBody, signature } = signedRequest({
        event: 'charge.success',
        data: { reference: 'invoice-1' },
      });

      const result = await controller.paystack({ rawBody } as any, signature);

      expect(result).toEqual({ received: false });
    });

    it('confirms the invoice as paid on a valid charge.success event', async () => {
      const { rawBody, signature } = signedRequest({
        event: 'charge.success',
        data: { reference: 'invoice-1' },
      });

      const result = await controller.paystack({ rawBody } as any, signature);

      expect(result).toEqual({ received: true });
      expect(
        billingService.confirmInvoicePaidByTransactionReference,
      ).toHaveBeenCalledWith(PaymentProviderType.PAYSTACK, 'invoice-1');
    });

    it('records a transaction failure on a valid charge.failed event', async () => {
      const { rawBody, signature } = signedRequest({
        event: 'charge.failed',
        data: { reference: 'invoice-1' },
      });

      await controller.paystack({ rawBody } as any, signature);

      expect(billingService.recordTransactionFailure).toHaveBeenCalledWith(
        PaymentProviderType.PAYSTACK,
        'invoice-1',
      );
    });
  });

  describe('mpesa', () => {
    it('drops the callback when the token does not match', async () => {
      const result = await controller.mpesa(
        {
          Body: {
            stkCallback: { CheckoutRequestID: 'ws_1', ResultCode: 0 },
          },
        },
        'wrong-token',
      );

      expect(result).toEqual({ ResultCode: 0, ResultDesc: 'Accepted' });
      expect(
        billingService.confirmInvoicePaidByTransactionReference,
      ).not.toHaveBeenCalled();
    });

    it('confirms the invoice as paid when ResultCode is 0', async () => {
      await controller.mpesa(
        {
          Body: {
            stkCallback: { CheckoutRequestID: 'ws_1', ResultCode: 0 },
          },
        },
        'shared-secret',
      );

      expect(
        billingService.confirmInvoicePaidByTransactionReference,
      ).toHaveBeenCalledWith(PaymentProviderType.MPESA, 'ws_1');
    });

    it('records a transaction failure when ResultCode is non-zero', async () => {
      await controller.mpesa(
        {
          Body: {
            stkCallback: { CheckoutRequestID: 'ws_1', ResultCode: 1032 },
          },
        },
        'shared-secret',
      );

      expect(billingService.recordTransactionFailure).toHaveBeenCalledWith(
        PaymentProviderType.MPESA,
        'ws_1',
      );
    });
  });
});
