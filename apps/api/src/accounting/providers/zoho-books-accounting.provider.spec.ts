import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios from 'axios';
import { ZohoBooksAccountingProvider } from './zoho-books-accounting.provider';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('ZohoBooksAccountingProvider', () => {
  let provider: ZohoBooksAccountingProvider;
  let configService: { get: jest.Mock };
  const credentials = { accessToken: 'access-token', externalId: 'org-123' };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = { get: jest.fn() };
    provider = new ZohoBooksAccountingProvider(configService as any);
  });

  function withConfig() {
    configService.get.mockImplementation(((key: string) => {
      if (key === 'accounting') {
        return {
          zohoBooks: {
            clientId: 'client-id',
            clientSecret: 'client-secret',
            region: 'com',
          },
        };
      }
      if (key === 'apiPublicUrl') return 'https://api.example.com';
      return undefined;
    }) as any);
  }

  describe('isConfigured', () => {
    it('is false when client id/secret are unset', () => {
      configService.get.mockReturnValue({ zohoBooks: {} });
      expect(provider.isConfigured()).toBe(false);
    });

    it('is true once client id/secret are set', () => {
      withConfig();
      expect(provider.isConfigured()).toBe(true);
    });
  });

  describe('getAuthorizeUrl', () => {
    it('builds a region-specific Zoho authorize URL carrying the state and redirect_uri', () => {
      withConfig();
      const url = provider.getAuthorizeUrl('signed-state');
      expect(url).toContain('https://accounts.zoho.com/oauth/v2/auth?');
      expect(url).toContain('state=signed-state');
      expect(url).toContain(
        encodeURIComponent(
          'https://api.example.com/accounting/integrations/callback/ZOHO_BOOKS',
        ),
      );
      expect(url).toContain('scope=ZohoBooks.fullaccess.all');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges the code then fetches the organization_id', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        },
      });
      mockedAxios.get.mockResolvedValueOnce({
        data: { organizations: [{ organization_id: 'org-123' }] },
      });

      const result = await provider.exchangeCodeForTokens('auth-code', {});

      expect(result.accessToken).toBe('new-access');
      expect(result.externalId).toBe('org-123');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://www.zohoapis.com/books/v3/organizations',
        expect.objectContaining({
          headers: { Authorization: 'Zoho-oauthtoken new-access' },
        }),
      );
    });

    it('throws when Zoho reports no organization', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          access_token: 'new-access',
          refresh_token: 'new-refresh',
          expires_in: 3600,
        },
      });
      mockedAxios.get.mockResolvedValueOnce({ data: { organizations: [] } });

      await expect(
        provider.exchangeCodeForTokens('auth-code', {}),
      ).rejects.toThrow('no organization');
    });
  });

  describe('refreshAccessToken', () => {
    it('exchanges a refresh token and preserves the original refresh token, since Zoho does not rotate it', async () => {
      withConfig();
      mockedAxios.post.mockResolvedValueOnce({
        data: { access_token: 'refreshed-access', expires_in: 3600 },
      });

      const result = await provider.refreshAccessToken('original-refresh');

      expect(result.accessToken).toBe('refreshed-access');
      expect(result.refreshToken).toBe('original-refresh');
    });
  });

  describe('syncInvoice', () => {
    it('reuses an existing account and posts a balanced journal', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { chartofaccounts: [{ account_id: 'account-1' }] },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { journal: { journal_id: 'journal-1' } },
      });

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result).toEqual({ success: true, externalId: 'journal-1' });
      const [, body] = mockedAxios.post.mock.calls[0];
      expect((body as any).line_items).toHaveLength(2);
      expect((body as any).line_items[0].debit_or_credit).toBe('debit');
      expect((body as any).line_items[1].debit_or_credit).toBe('credit');
    });

    it('creates the account when it does not already exist', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({ data: { chartofaccounts: [] } });
      mockedAxios.post
        .mockResolvedValueOnce({
          data: { chart_of_account: { account_id: 'new-account-1' } },
        })
        .mockResolvedValueOnce({
          data: { chart_of_account: { account_id: 'new-account-2' } },
        })
        .mockResolvedValueOnce({
          data: { journal: { journal_id: 'journal-2' } },
        });

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(3);
    });

    it('reports failure instead of throwing when the API call fails', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { chartofaccounts: [{ account_id: 'account-1' }] },
      });
      mockedAxios.post.mockRejectedValueOnce(new Error('Zoho down'));

      const result = await provider.syncInvoice(credentials, {
        amount: 500,
      } as any);

      expect(result).toEqual({ success: false, error: 'Zoho down' });
    });
  });

  describe('syncPayrollExpense', () => {
    it('posts a three-line journal for gross/deductions/net', async () => {
      withConfig();
      mockedAxios.get.mockResolvedValue({
        data: { chartofaccounts: [{ account_id: 'account-1' }] },
      });
      mockedAxios.post.mockResolvedValueOnce({
        data: { journal: { journal_id: 'journal-3' } },
      });

      const result = await provider.syncPayrollExpense(credentials, {
        period: '2026-07',
        totals: { grossPay: 1000, totalDeductions: 200, netPay: 800 },
      } as any);

      expect(result.success).toBe(true);
      const [, body] = mockedAxios.post.mock.calls[0];
      expect((body as any).line_items).toHaveLength(3);
      expect((body as any).notes).toContain('2026-07');
    });
  });
});
