import { randomBytes, createHmac } from 'crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebhookEndpoint } from '@prisma/client';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';
import { assertPublicWebhookUrl } from './ssrf-guard';

const DELIVERY_TIMEOUT_MS = 5000;
const DELIVERIES_LIST_LIMIT = 50;

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Secret storage model: webhook secrets are credentials the SERVER holds
   * and uses to SIGN outgoing requests (needed in retrievable form on every
   * dispatch), unlike API keys which are credentials PRESENTED TO the
   * server (correctly one-way hashed in ApiKeysService). Mirrors how
   * Stripe/GitHub store webhook signing secrets. `secret` is server-
   * generated here — never accepted from the client.
   */
  async create(
    tenantId: string,
    dto: CreateWebhookDto,
  ): Promise<WebhookEndpoint> {
    await assertPublicWebhookUrl(dto.url);
    const secret = randomBytes(32).toString('hex');
    // This create() response is the ONLY place the full, unmasked secret is
    // ever returned again — list() below masks it.
    return this.prisma.webhookEndpoint.create({
      data: {
        tenantId,
        url: dto.url,
        events: dto.events,
        secret,
      },
    });
  }

  async list(tenantId: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return endpoints.map((endpoint) => ({
      ...endpoint,
      secret: `whsec_...${endpoint.secret.slice(-4)}`,
    }));
  }

  private async findOwned(
    tenantId: string,
    id: string,
  ): Promise<WebhookEndpoint> {
    const endpoint = await this.prisma.webhookEndpoint.findUnique({
      where: { id },
    });
    if (!endpoint || endpoint.tenantId !== tenantId) {
      throw new NotFoundException('Webhook endpoint not found');
    }
    return endpoint;
  }

  async update(
    tenantId: string,
    id: string,
    dto: UpdateWebhookDto,
  ): Promise<WebhookEndpoint> {
    await this.findOwned(tenantId, id);
    if (dto.url !== undefined) {
      await assertPublicWebhookUrl(dto.url);
    }
    return this.prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(dto.url !== undefined ? { url: dto.url } : {}),
        ...(dto.events !== undefined ? { events: dto.events } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.findOwned(tenantId, id);
    await this.prisma.webhookEndpoint.delete({ where: { id } });
  }

  async listDeliveries(tenantId: string, id: string) {
    await this.findOwned(tenantId, id);
    return this.prisma.webhookDeliveryLog.findMany({
      where: { webhookEndpointId: id },
      orderBy: { createdAt: 'desc' },
      take: DELIVERIES_LIST_LIMIT,
    });
  }

  /**
   * Best-effort, fire-and-forget dispatch — NO retry. Explicit gap: no
   * retry queue / dead-lettering; a single delivery attempt is made per
   * event, and failures are visible only via WebhookDeliveryLog +
   * Logger.error. A BullMQ-backed retry queue is the natural next step
   * (Redis is already wired for the app) but is deliberately deferred.
   */
  async dispatch(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const endpoints = await this.prisma.webhookEndpoint.findMany({
        where: { tenantId, isActive: true, events: { has: event } },
      });
      await Promise.all(
        endpoints.map((ep) => this.deliverOne(ep, event, payload)),
      );
    } catch (error) {
      this.logger.error(
        `Failed to dispatch webhook event ${event} for tenant ${tenantId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async deliverOne(
    endpoint: WebhookEndpoint,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const body = JSON.stringify(payload);
    const signature = createHmac('sha256', endpoint.secret)
      .update(body)
      .digest('hex');

    let statusCode: number | undefined;
    let success = false;
    let error: string | undefined;

    try {
      // Re-check at dispatch time, not just at create/update — narrows the
      // window for DNS-rebinding (endpoint.url resolving to a private
      // address only after it passed the create-time check).
      await assertPublicWebhookUrl(endpoint.url);
      const response = await axios.post(endpoint.url, payload, {
        headers: {
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
        },
        timeout: DELIVERY_TIMEOUT_MS,
      });
      statusCode = response.status;
      success = response.status >= 200 && response.status < 300;
    } catch (err) {
      success = false;
      if (axios.isAxiosError(err)) {
        statusCode = err.response?.status;
        error = err.message;
      } else {
        error = err instanceof Error ? err.message : String(err);
      }
      this.logger.error(
        `Webhook delivery failed for endpoint ${endpoint.id} (event ${event}): ${error}`,
      );
    }

    await this.prisma.webhookDeliveryLog.create({
      data: {
        webhookEndpointId: endpoint.id,
        event,
        payload: payload as any,
        statusCode,
        success,
        error,
      },
    });
  }
}
