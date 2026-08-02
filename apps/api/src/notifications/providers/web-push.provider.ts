import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import webpush from 'web-push';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { PushProvider, PushSendResult } from '../push-provider.interface';

/**
 * Real Web Push (RFC 8030/8291) delivery via VAPID, following the same
 * config-gated pattern as AfricasTalkingSmsProvider/PaystackProvider.
 * Selected in place of NoopPushProvider by the factory in
 * notifications.module.ts once VAPID_PUBLIC_KEY/PRIVATE_KEY are set.
 *
 * Unlike the SMS/email providers, this one owns its own recipient lookup —
 * push-provider.interface.ts's `send(userId, ...)` has no destination
 * address to hand in, since a user can have any number of subscribed
 * browsers/devices (see PushSubscription). Delivery fans out to all of a
 * user's subscriptions; a subscription the push service reports as gone
 * (404/410) is deleted so it isn't retried forever.
 */
@Injectable()
export class WebPushProvider implements PushProvider {
  readonly name = 'web-push';
  private readonly logger = new Logger(WebPushProvider.name);

  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly prisma: PrismaService,
  ) {}

  async send(
    userId: string,
    title: string,
    body: string,
  ): Promise<PushSendResult> {
    const config = this.configService.get('vapid', { infer: true });
    if (!config.publicKey || !config.privateKey) {
      this.logger.warn('VAPID keys not set — push not sent');
      return { success: false, error: 'Push provider not configured' };
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) {
      return { success: false, error: 'No push subscriptions for user' };
    }

    webpush.setVapidDetails(
      config.subject,
      config.publicKey,
      config.privateKey,
    );
    const payload = JSON.stringify({ title, body });

    const results = await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            payload,
          );
          return true;
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.prisma.pushSubscription
              .delete({ where: { id: subscription.id } })
              .catch(() => undefined);
          } else {
            this.logger.error(
              `Failed to deliver push to subscription ${subscription.id}`,
              error as Error,
            );
          }
          return false;
        }
      }),
    );

    return results.some(Boolean)
      ? { success: true }
      : { success: false, error: 'Delivery failed for all subscriptions' };
  }
}
