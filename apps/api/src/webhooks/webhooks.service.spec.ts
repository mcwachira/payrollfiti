import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import axios from 'axios';
import { WebhooksService } from './webhooks.service';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// The real ssrf-guard does a DNS lookup, which these tests shouldn't
// depend on — SSRF-blocking behavior itself is covered by ssrf-guard.spec.ts.
jest.mock('./ssrf-guard', () => ({
  assertPublicWebhookUrl: jest
    .fn<(...args: any[]) => Promise<void>>()
    .mockResolvedValue(undefined),
}));

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('WebhooksService', () => {
  let service: WebhooksService;
  let prisma: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest
      .fn()
      .mockReturnValue(false);

    prisma = {
      webhookEndpoint: {
        create: asyncMock({}),
        findMany: asyncMock([]),
        findUnique: asyncMock(null),
        update: asyncMock({}),
        delete: asyncMock({}),
      },
      webhookDeliveryLog: {
        create: asyncMock({}),
        findMany: asyncMock([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  describe('dispatch', () => {
    it('only queries endpoints filtered by isActive and events has the dispatched event', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);

      await service.dispatch('tenant-1', 'payroll.run.completed', {
        runId: 'run-1',
      });

      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-1',
          isActive: true,
          events: { has: 'payroll.run.completed' },
        },
      });
    });

    it('writes a WebhookDeliveryLog with success:false and does not throw when axios.post rejects', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([
        {
          id: 'ep-1',
          tenantId: 'tenant-1',
          url: 'https://example.com/hook',
          secret: 'topsecret',
          events: ['payroll.run.completed'],
          isActive: true,
        },
      ]);
      mockedAxios.post.mockRejectedValue(new Error('network down'));

      await expect(
        service.dispatch('tenant-1', 'payroll.run.completed', {
          runId: 'run-1',
        }),
      ).resolves.toBeUndefined();

      expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            webhookEndpointId: 'ep-1',
            event: 'payroll.run.completed',
            success: false,
          }),
        }),
      );
    });

    it('signs the payload with the endpoint secret using HMAC-SHA256 of the JSON payload', async () => {
      const endpoint = {
        id: 'ep-1',
        tenantId: 'tenant-1',
        url: 'https://example.com/hook',
        secret: 'my-webhook-secret',
        events: ['invoice.paid'],
        isActive: true,
      };
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);
      mockedAxios.post.mockResolvedValue({ status: 200 });

      const payload = { invoiceId: 'inv-1', amount: 100 };
      await service.dispatch('tenant-1', 'invoice.paid', payload);

      const expectedSignature = createHmac('sha256', endpoint.secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      expect(mockedAxios.post).toHaveBeenCalledWith(
        endpoint.url,
        payload,
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expectedSignature,
            'X-Webhook-Event': 'invoice.paid',
          }),
        }),
      );
      expect(prisma.webhookDeliveryLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ success: true, statusCode: 200 }),
        }),
      );
    });

    it('never throws out of dispatch even if the initial findMany query fails', async () => {
      prisma.webhookEndpoint.findMany.mockRejectedValue(new Error('db down'));

      await expect(
        service.dispatch('tenant-1', 'invoice.paid', {}),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('masks the secret, retaining only the last 4 characters', async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([
        { id: 'ep-1', secret: 'abcdefgh1234', tenantId: 'tenant-1' },
      ]);

      const result = await service.list('tenant-1');

      expect(result[0].secret).toBe('whsec_...1234');
    });
  });
});
