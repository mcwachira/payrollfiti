import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountingProviderType } from '@prisma/client';
import { AccountingIntegrationsService } from './accounting-integrations.service';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('AccountingIntegrationsService', () => {
  let service: AccountingIntegrationsService;
  let prisma: any;
  let encryptionService: any;
  let jwtService: any;
  let configService: { get: jest.Mock };
  let registry: any;
  let quickbooksClient: any;
  let xeroClient: any;

  const integration = {
    tenantId: 'tenant-1',
    provider: AccountingProviderType.QUICKBOOKS,
    externalId: 'realm-1',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    prisma = {
      accountingIntegration: {
        findUnique: asyncMock(null),
        upsert: asyncMock(undefined),
        delete: asyncMock(undefined),
      },
    };
    encryptionService = {
      encrypt: jest.fn((value: string) => `enc(${value})`),
    };
    jwtService = {
      signAsync: asyncMock('signed-state'),
      verifyAsync: asyncMock({
        purpose: 'accounting-oauth-state',
        tenantId: 'tenant-1',
        userId: 'user-1',
        provider: AccountingProviderType.QUICKBOOKS,
      }),
    };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'jwt') return { accessSecret: 'access-secret' };
        return undefined;
      }) as any,
    };
    quickbooksClient = {
      provider: AccountingProviderType.QUICKBOOKS,
      isConfigured: jest.fn().mockReturnValue(true),
      getAuthorizeUrl: jest
        .fn()
        .mockReturnValue('https://appcenter.intuit.com/connect/oauth2?...'),
      exchangeCodeForTokens: asyncMock({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        externalId: 'realm-1',
      }),
    };
    xeroClient = {
      provider: AccountingProviderType.XERO,
      isConfigured: jest.fn().mockReturnValue(false),
    };
    registry = {
      get: jest.fn((provider: AccountingProviderType) =>
        provider === AccountingProviderType.QUICKBOOKS
          ? quickbooksClient
          : xeroClient,
      ),
      all: jest.fn().mockReturnValue([quickbooksClient, xeroClient]),
    };
    service = new AccountingIntegrationsService(
      prisma,
      encryptionService,
      jwtService,
      configService as any,
      registry,
    );
  });

  describe('listStatus', () => {
    it('reports configured/connected per provider when nothing is connected', async () => {
      const result = await service.listStatus('tenant-1');

      expect(result).toEqual([
        {
          provider: AccountingProviderType.QUICKBOOKS,
          configured: true,
          connected: false,
          connectedAt: null,
        },
        {
          provider: AccountingProviderType.XERO,
          configured: false,
          connected: false,
          connectedAt: null,
        },
      ]);
    });

    it('marks the connected provider and its connectedAt', async () => {
      prisma.accountingIntegration.findUnique.mockResolvedValueOnce(
        integration,
      );

      const result = await service.listStatus('tenant-1');

      expect(result[0]).toEqual({
        provider: AccountingProviderType.QUICKBOOKS,
        configured: true,
        connected: true,
        connectedAt: integration.createdAt,
      });
      expect(result[1].connected).toBe(false);
    });
  });

  describe('getAuthorizeUrl', () => {
    it('signs a purpose-tagged state token and returns the client authorize URL', async () => {
      const url = await service.getAuthorizeUrl(
        'tenant-1',
        'user-1',
        AccountingProviderType.QUICKBOOKS,
      );

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        {
          purpose: 'accounting-oauth-state',
          tenantId: 'tenant-1',
          userId: 'user-1',
          provider: AccountingProviderType.QUICKBOOKS,
        },
        { secret: 'access-secret', expiresIn: '10m' },
      );
      expect(quickbooksClient.getAuthorizeUrl).toHaveBeenCalledWith(
        'signed-state',
      );
      expect(url).toBe('https://appcenter.intuit.com/connect/oauth2?...');
    });

    it('throws BadRequestException when the provider is not configured', async () => {
      await expect(
        service.getAuthorizeUrl(
          'tenant-1',
          'user-1',
          AccountingProviderType.XERO,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('handleCallback', () => {
    it('exchanges the code and upserts an encrypted AccountingIntegration row', async () => {
      await service.handleCallback(
        AccountingProviderType.QUICKBOOKS,
        'auth-code',
        'signed-state',
        {
          realmId: 'realm-1',
        },
      );

      expect(quickbooksClient.exchangeCodeForTokens).toHaveBeenCalledWith(
        'auth-code',
        { realmId: 'realm-1' },
      );
      expect(prisma.accountingIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1' },
          create: expect.objectContaining({
            tenantId: 'tenant-1',
            provider: AccountingProviderType.QUICKBOOKS,
            externalId: 'realm-1',
            accessTokenEncrypted: 'enc(access)',
            refreshTokenEncrypted: 'enc(refresh)',
            connectedById: 'user-1',
          }),
        }),
      );
    });

    it('rejects when the state JWT fails verification', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('jwt expired'));

      await expect(
        service.handleCallback(
          AccountingProviderType.QUICKBOOKS,
          'auth-code',
          'bad-state',
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.accountingIntegration.upsert).not.toHaveBeenCalled();
    });

    it('rejects when the path provider does not match the provider embedded in state', async () => {
      await expect(
        service.handleCallback(
          AccountingProviderType.XERO,
          'auth-code',
          'signed-state',
          {},
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.accountingIntegration.upsert).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('deletes the integration when it matches the given provider', async () => {
      prisma.accountingIntegration.findUnique.mockResolvedValueOnce(
        integration,
      );

      await service.disconnect('tenant-1', AccountingProviderType.QUICKBOOKS);

      expect(prisma.accountingIntegration.delete).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
    });

    it('throws NotFoundException when nothing is connected', async () => {
      await expect(
        service.disconnect('tenant-1', AccountingProviderType.QUICKBOOKS),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.accountingIntegration.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a different provider is connected', async () => {
      prisma.accountingIntegration.findUnique.mockResolvedValueOnce(
        integration,
      );

      await expect(
        service.disconnect('tenant-1', AccountingProviderType.XERO),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.accountingIntegration.delete).not.toHaveBeenCalled();
    });
  });
});
