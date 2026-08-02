import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AccountingProviderType } from '@prisma/client';
import { AccountingProviderRouter } from './accounting-provider-router';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AccountingProviderRouter', () => {
  let router: AccountingProviderRouter;
  let prisma: any;
  let encryptionService: any;
  let registry: any;
  let quickbooksClient: any;

  const integration = {
    tenantId: 'tenant-1',
    provider: AccountingProviderType.QUICKBOOKS,
    externalId: 'realm-1',
    accessTokenEncrypted: 'enc(access)',
    refreshTokenEncrypted: 'enc(refresh)',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  };

  const invoice = {
    id: 'inv-1',
    tenantId: 'tenant-1',
    amount: 500,
    currency: 'KES',
    status: 'PAID',
  };

  beforeEach(() => {
    prisma = {
      accountingIntegration: {
        findUnique: asyncMock(integration),
        update: asyncMock(undefined),
      },
    };
    encryptionService = {
      decrypt: jest.fn((value: string) =>
        value.replace('enc(', '').replace(')', ''),
      ),
      encrypt: jest.fn((value: string) => `enc(${value})`),
    };
    quickbooksClient = {
      syncInvoice: asyncMock({ success: true, externalId: 'je-1' }),
      syncPayrollExpense: asyncMock({ success: true, externalId: 'je-2' }),
      refreshAccessToken: asyncMock({
        accessToken: 'refreshed-access',
        refreshToken: 'refreshed-refresh',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        externalId: '',
      }),
    };
    registry = { get: jest.fn().mockReturnValue(quickbooksClient) };
    router = new AccountingProviderRouter(prisma, encryptionService, registry);
  });

  describe('syncInvoice', () => {
    it('returns a not-connected result when the tenant has no integration', async () => {
      prisma.accountingIntegration.findUnique.mockResolvedValueOnce(null);

      const result = await router.syncInvoice(invoice);

      expect(result).toEqual({
        success: false,
        error: 'No accounting integration connected for this tenant',
      });
      expect(quickbooksClient.syncInvoice).not.toHaveBeenCalled();
    });

    it('decrypts stored credentials and delegates to the connected provider client', async () => {
      const result = await router.syncInvoice(invoice);

      expect(result).toEqual({ success: true, externalId: 'je-1' });
      expect(quickbooksClient.syncInvoice).toHaveBeenCalledWith(
        { accessToken: 'access', externalId: 'realm-1' },
        invoice,
      );
      expect(quickbooksClient.refreshAccessToken).not.toHaveBeenCalled();
    });

    it('refreshes an expiring token before syncing, and persists the refreshed tokens', async () => {
      prisma.accountingIntegration.findUnique.mockResolvedValueOnce({
        ...integration,
        expiresAt: new Date(Date.now() + 30_000), // inside the refresh skew window
      });

      const result = await router.syncInvoice(invoice);

      expect(result.success).toBe(true);
      expect(quickbooksClient.refreshAccessToken).toHaveBeenCalledWith(
        'refresh',
      );
      expect(prisma.accountingIntegration.update).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        data: {
          accessTokenEncrypted: 'enc(refreshed-access)',
          refreshTokenEncrypted: 'enc(refreshed-refresh)',
          expiresAt: expect.any(Date),
        },
      });
      expect(quickbooksClient.syncInvoice).toHaveBeenCalledWith(
        { accessToken: 'refreshed-access', externalId: 'realm-1' },
        invoice,
      );
    });

    it('returns a not-connected result when the token refresh itself fails', async () => {
      prisma.accountingIntegration.findUnique.mockResolvedValueOnce({
        ...integration,
        expiresAt: new Date(Date.now() + 30_000),
      });
      quickbooksClient.refreshAccessToken.mockRejectedValueOnce(
        new Error('invalid_grant'),
      );

      const result = await router.syncInvoice(invoice);

      expect(result.success).toBe(false);
      expect(quickbooksClient.syncInvoice).not.toHaveBeenCalled();
    });
  });

  describe('syncPayrollExpense', () => {
    it('delegates to the connected provider client', async () => {
      const run = {
        id: 'run-1',
        tenantId: 'tenant-1',
        companyId: 'co-1',
        period: '2026-07',
        totals: {},
      };

      const result = await router.syncPayrollExpense(run);

      expect(result).toEqual({ success: true, externalId: 'je-2' });
      expect(quickbooksClient.syncPayrollExpense).toHaveBeenCalledWith(
        { accessToken: 'access', externalId: 'realm-1' },
        run,
      );
    });
  });
});
