import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { QuickBooksAccountingProvider } from './quickbooks-accounting.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('QuickBooksAccountingProvider', () => {
  let provider: QuickBooksAccountingProvider;
  let configService: { get: jest.Mock };
  const credentials = { accessToken: 'access-token', externalId: 'realm-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = { get: jest.fn() };
    provider = new QuickBooksAccountingProvider(configService as any);
  });

  function withConfig() {
    configService.get.mockImplementation(((key: string) => {
      if (key === 'accounting') {
        return {
          quickbooks: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            environment: 'sandbox',
          },
        };
      }
      if (key === 'apiPublicUrl') return 'https://api.example.com';
      return undefined;
    }) as any);
  }

  describe('isConfigured', () => {
    it('is false when client id/secret are unset', () => {
      configService.get.mockReturnValue({ quickbooks: {} });
      expect(provider.isConfigured()).toBe(false);
    });

    it('is true once client id/secret are set', () => {
      withConfig();
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('getAuthorizeUrl', () => {
    it('builds an Intuit authorize URL carrying the state and redirect_uri', () => {
      withConfig();
      const url = provider.getAuthorizeUrl('signed-state');
      expect(url).toContain('https://appcenter.intuit.com/connect/oauth2?');
      expect(url).toContain('state=signed-state');
      expect(url).toContain(
        encodeURIComponent(
          'https://api.example.com/accounting/integrations/callback/QUICKBOOKS',
        ),
      );
      expect(url).toContain('scope=com.intuit.quickbooks.accounting');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges the code and reads realmId from the callback params, not the token response', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        },
      });

      const result = await provider.exchangeCodeForTokens('auth-code', {
        realmId: 'realm-123',
      });

      expect(result.accessToken).toBe('new-access');
      expect(result.refreshToken).toBe('new-refresh');
      expect(result.externalId).toBe('realm-123');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        expect.any(URLSearchParams),
        expect.objectContaining({
          auth: { username: 'client-id', password: 'client-secret' },
        }),
      );
    });

    it('throws when the callback has no realmId', async () => {
      withConfig();
      await expect(
        provider.exchangeCodeForTokens('auth-code', {}),
      ).rejects.toThrow('realmId');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
  });

  describe('refreshAccessToken', () => {
    it('exchanges a refresh token for a new access token', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'refreshed-access',
          refresh_token: 'refreshed-refresh',
          expires_in: 3600,
        },
      });

      const result = await provider.refreshAccessToken('old-refresh');

      expect(result.accessToken).toBe('refreshed-access');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        expect.any(URLSearchParams),
        expect.any(Object),
      );
    });
  });

  describe('syncInvoice', () => {
    it('reuses an existing account and posts a balanced journal entry', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { QueryResponse: { Account: [{ Id: 'account-1' }] } },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { JournalEntry: { Id: 'je-1' } },
      });

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result).toEqual({ success: true, externalId: 'je-1' });
      const [, body] = mockedAxios.post.mock.calls[0];
      expect((body as any).Line).toHaveLength(2);
      expect((body as any).Line[0].JournalEntryLineDetail.PostingType).toBe(
        'Debit',
      );
      expect((body as any).Line[1].JournalEntryLineDetail.PostingType).toBe(
        'Credit',
      );
    });

    it('creates the account when it does not already exist', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({ data: { QueryResponse: {} } });
      mockedAxios.post
        .mockResolvedValueOnce({ data: { Account: { Id: 'new-account' } } }) // create expense account
        .mockResolvedValueOnce({ data: { Account: { Id: 'new-account-2' } } }) // create bank account
        .mockResolvedValueOnce({ data: { JournalEntry: { Id: 'je-2' } } }); // post journal

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('reports failure instead of throwing when the API call fails', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { QueryResponse: { Account: [{ Id: 'account-1' }] } },
      });
      mockedAxios.post.mockRejectedValueOnce(new Error('QBO down'));

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result).toEqual({ success: false, error: 'QBO down' });
    });
  });

  describe('syncPayrollExpense', () => {
    it('posts a three-line journal entry for gross/deductions/net', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { QueryResponse: { Account: [{ Id: 'account-1' }] } },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { JournalEntry: { Id: 'je-3' } },
      });

      const result = await provider.syncPayrollExpense(credentials, {
        totals: { grossPay: 1000, totalDeductions: 200, netPay: 800 },
      } as any);

      expect(result.success).toBe(true);
      const [, body] = mockedAxios.post.mock.calls[0];
      expect((body as any).Line).toHaveLength(3);
    });

    it('omits zero-amount lines rather than posting a $0 journal line', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { QueryResponse: { Account: [{ Id: 'account-1' }] } },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { JournalEntry: { Id: 'je-4' } },
      });

      await provider.syncPayrollExpense(credentials, {
        totals: { grossPay: 1000, totalDeductions: 0, netPay: 1000 },
      } as any);

      const [, body] = mockedAxios.post.mock.calls[0];
      expect((body as any).Line).toHaveLength(2);
    });
  });
});
