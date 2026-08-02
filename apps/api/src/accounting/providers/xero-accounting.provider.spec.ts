import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { XeroAccountingProvider } from './xero-accounting.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('XeroAccountingProvider', () => {
  let provider: XeroAccountingProvider;
  let configService: { get: jest.Mock };
  const credentials = {
    accessToken: 'access-token',
    externalId: 'xero-tenant-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = { get: jest.fn() };
    provider = new XeroAccountingProvider(configService as any);
  });

  function withConfig() {
    configService.get.mockImplementation(((key: string) => {
      if (key === 'accounting') {
        return {
          xero: { clientId: 'client-id', clientSecret: 'client-secret' },
        };
      }
      if (key === 'apiPublicUrl') return 'https://api.example.com';
      return undefined;
    }) as any);
  }

  describe('isConfigured', () => {
    it('is false when client id/secret are unset', () => {
      configService.get.mockReturnValue({ xero: {} });
      expect(provider.isConfigured()).toBe(false);
    });

    it('is true once client id/secret are set', () => {
      withConfig();
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('getAuthorizeUrl', () => {
    it('builds a Xero authorize URL carrying the state and redirect_uri', () => {
      withConfig();
      const url = provider.getAuthorizeUrl('signed-state');
      expect(url).toContain(
        'https://login.xero.com/identity/connect/authorize?',
      );
      expect(url).toContain('state=signed-state');
      expect(url).toContain(
        encodeURIComponent(
          'https://api.example.com/accounting/integrations/callback/XERO',
        ),
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges the code then fetches the xero-tenant-id from /connections', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 1800,
        },
      });
      mockedAxios.get.mockResolvedValueOnce({
        data: [{ tenantId: 'xero-tenant-1', tenantName: 'Acme' }],
      });

      const result = await provider.exchangeCodeForTokens('auth-code', {});

      expect(result.accessToken).toBe('new-access');
      expect(result.externalId).toBe('xero-tenant-1');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.xero.com/connections',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer new-access',
          }),
        }),
      );
    });

    it('throws when Xero reports no connected organisation', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 1800,
        },
      });
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      await expect(
        provider.exchangeCodeForTokens('auth-code', {}),
      ).rejects.toThrow('no connected organisation');
    });
  });

  describe('refreshAccessToken', () => {
    it('exchanges a refresh token for a new access token', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'refreshed-access',
          refresh_token: 'refreshed-refresh',
          expires_in: 1800,
        },
      });

      const result = await provider.refreshAccessToken('old-refresh');

      expect(result.accessToken).toBe('refreshed-access');
    });
  });

  describe('syncInvoice', () => {
    it('reuses an existing account by Code and posts a balanced manual journal', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { Accounts: [{ Code: '1234' }] },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { ManualJournals: [{ ManualJournalID: 'mj-1' }] },
      });

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result).toEqual({ success: true, externalId: 'mj-1' });
      const [, body] = mockedAxios.post.mock.calls[0];
      const lines = (body as any).ManualJournals[0].JournalLines;
      expect(lines).toHaveLength(2);
      expect(lines[0].LineAmount).toBe(500);
      expect(lines[1].LineAmount).toBe(-500);
    });

    it('creates the account via PUT when it does not already exist', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({ data: {} });
      mockedAxios.put.mockResolvedValue({
        data: { Accounts: [{ Code: '5678' }] },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { ManualJournals: [{ ManualJournalID: 'mj-2' }] },
      });

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result.success).toBe(true);
      expect(mockedAxios.put).toHaveBeenCalledTimes(2);
    });

    it('reports failure instead of throwing when the API call fails', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { Accounts: [{ Code: '1234' }] },
      });
      mockedAxios.post.mockRejectedValueOnce(new Error('Xero down'));

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result).toEqual({ success: false, error: 'Xero down' });
    });
  });

  describe('syncPayrollExpense', () => {
    it('posts a three-line manual journal for gross/deductions/net', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { Accounts: [{ Code: '1234' }] },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { ManualJournals: [{ ManualJournalID: 'mj-3' }] },
      });

      const result = await provider.syncPayrollExpense(credentials, {
        period: '2026-07',
        totals: { grossPay: 1000, totalDeductions: 200, netPay: 800 },
      } as any);

      expect(result.success).toBe(true);
      const [, body] = mockedAxios.post.mock.calls[0];
      expect((body as any).ManualJournals[0].JournalLines).toHaveLength(3);
      expect((body as any).ManualJournals[0].Narration).toContain('2026-07');
    });
  });
});
