import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { PaystackProvider } from './paystack.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PaystackProvider', () => {
  let configService: { get: jest.Mock<(...args: any[]) => any> };

  const configured = (secretKey?: string) => {
    configService = {
      get: jest.fn<(key: string) => any>((key: string) => {
        if (key === 'paystack') return { secretKey };
        if (key === 'corsOrigin') return 'http://localhost:3001';
        return undefined;
      }),
    };
    return new PaystackProvider(configService as any);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when PAYSTACK_SECRET_KEY is not set', () => {
    it('returns a stub customer id without calling the API', async () => {
      const provider = configured(undefined);

      const id = await provider.createCustomer({
        tenantId: 'tenant-1',
        name: 'Acme',
        email: 'admin@acme.co.ke',
      });

      expect(id).toBe('stub_cus_tenant-1');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('simulates a successful charge without calling the API', async () => {
      const provider = configured(undefined);

      const result = await provider.charge({
        amount: 2000,
        currency: 'KES',
        reference: 'invoice-1',
        email: 'admin@acme.co.ke',
      });

      expect(result).toEqual({
        providerReference: 'stub_paystack_invoice-1',
        status: 'succeeded',
        raw: null,
      });
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('when PAYSTACK_SECRET_KEY is set', () => {
    it('creates a real customer via the Paystack API', async () => {
      const provider = configured('sk_test_123');
      mockedAxios.post.mockResolvedValueOnce({
        data: { data: { customer_code: 'CUS_abc123' } },
      });

      const id = await provider.createCustomer({
        tenantId: 'tenant-1',
        name: 'Acme HR',
        email: 'admin@acme.co.ke',
      });

      expect(id).toBe('CUS_abc123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/customer',
        expect.objectContaining({
          email: 'admin@acme.co.ke',
          first_name: 'Acme',
          last_name: 'HR',
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer sk_test_123' },
        }),
      );
    });

    it('initializes a transaction and returns a pending status with the authorization_url', async () => {
      const provider = configured('sk_test_123');
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          data: {
            authorization_url: 'https://checkout.paystack.com/abc123',
            access_code: 'abc123',
            reference: 'invoice-1',
          },
        },
      });

      const result = await provider.charge({
        amount: 2000,
        currency: 'KES',
        reference: 'invoice-1',
        email: 'admin@acme.co.ke',
      });

      expect(result.status).toBe('pending');
      expect(result.providerReference).toBe('invoice-1');
      expect(result.raw).toEqual(
        expect.objectContaining({
          authorization_url: 'https://checkout.paystack.com/abc123',
        }),
      );
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.paystack.co/transaction/initialize',
        expect.objectContaining({
          email: 'admin@acme.co.ke',
          amount: 200_000, // 2000 KES in kobo-equivalent subunits
          currency: 'KES',
          reference: 'invoice-1',
          callback_url: 'http://localhost:3001/billing',
        }),
        expect.objectContaining({
          headers: { Authorization: 'Bearer sk_test_123' },
        }),
      );
    });

    it('throws when charging without an email', async () => {
      const provider = configured('sk_test_123');

      await expect(
        provider.charge({ amount: 2000, currency: 'KES', reference: 'x' }),
      ).rejects.toThrow('Paystack charge requires an email');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });
});
