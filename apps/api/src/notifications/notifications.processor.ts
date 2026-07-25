import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail.service';
import { NotificationChannel } from './notification-channel.enum';
import { NOTIFICATIONS_QUEUE, NotificationDeliverJobData } from './notifications.queue';
import { renderNotificationTemplate } from './templates/notification-templates';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';
import { PUSH_PROVIDER, PushProvider } from './push-provider.interface';

/**
 * Consumes NOTIFICATION_DELIVER_JOB jobs enqueued by
 * NotificationsService.dispatch()/dispatchForRoles(). The in-app Notification
 * row is already written synchronously by the time this runs — this only
 * fans out to the out-of-band channels (email/SMS/push) requested by the
 * caller, off the request thread and with BullMQ's built-in retry.
 */
@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    @Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
  ) {
    super();
  }

  async process(job: Job<NotificationDeliverJobData>): Promise<void> {
    const { userId, type, message, metadata, channels } = job.data;

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const rendered = renderNotificationTemplate(type, message, metadata);

    for (const channel of channels) {
      switch (channel) {
        case NotificationChannel.EMAIL:
          await this.mailService.sendMail(
            user.email,
            rendered.subject,
            rendered.html,
          );
          break;
        case NotificationChannel.SMS:
          if (!user.phone) {
            this.logger.warn(
              `Skipping SMS for user ${userId} (${type}): no phone on file`,
            );
            break;
          }
          await this.smsProvider.send(user.phone, rendered.sms);
          break;
        case NotificationChannel.PUSH:
          await this.pushProvider.send(userId, rendered.subject, rendered.sms);
          break;
      }
    }
  }
}
