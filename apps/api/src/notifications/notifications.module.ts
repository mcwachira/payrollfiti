import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { PushSubscriptionsController } from './push-subscriptions.controller';
import { NotificationsProcessor } from './notifications.processor';
import { MailService } from './mail.service';
import { PayslipEmailService } from './payslip-email.service';
import { PayslipEmailsProcessor } from './payslip-emails.processor';
import { PayrollReminderService } from './payroll-reminder.service';
import { PayslipsModule } from '../payslips/payslips.module';
import { NOTIFICATIONS_QUEUE } from './notifications.queue';
import { PAYSLIP_EMAILS_QUEUE } from './payslip-emails.queue';
import { SMS_PROVIDER, SmsProvider } from './sms-provider.interface';
import { NoopSmsProvider } from './providers/noop-sms.provider';
import { AfricasTalkingSmsProvider } from './providers/africas-talking-sms.provider';
import { PUSH_PROVIDER, PushProvider } from './push-provider.interface';
import { NoopPushProvider } from './providers/noop-push.provider';
import { WebPushProvider } from './providers/web-push.provider';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PayslipsModule,
    BullModule.registerQueue(
      { name: NOTIFICATIONS_QUEUE },
      {
        name: PAYSLIP_EMAILS_QUEUE,
        // sendPayslipEmail() now throws on failure instead of swallowing it
        // (see its own comment) specifically so a transient failure —
        // mail provider hiccup, PDF render error — gets retried instead of
        // silently dropping that one employee's payslip.
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      },
    ),
  ],
  controllers: [NotificationsController, PushSubscriptionsController],
  providers: [
    NotificationsService,
    MailService,
    PayslipEmailService,
    PayrollReminderService,
    NotificationsProcessor,
    PayslipEmailsProcessor,
    NoopSmsProvider,
    AfricasTalkingSmsProvider,
    NoopPushProvider,
    WebPushProvider,
    {
      provide: SMS_PROVIDER,
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        africasTalking: AfricasTalkingSmsProvider,
        noop: NoopSmsProvider,
      ): SmsProvider => {
        const config = configService.get('africasTalking', { infer: true });
        return config.apiKey && config.username ? africasTalking : noop;
      },
      inject: [ConfigService, AfricasTalkingSmsProvider, NoopSmsProvider],
    },
    {
      provide: PUSH_PROVIDER,
      useFactory: (
        configService: ConfigService<AppConfig, true>,
        webPush: WebPushProvider,
        noop: NoopPushProvider,
      ): PushProvider => {
        const config = configService.get('vapid', { infer: true });
        return config.publicKey && config.privateKey ? webPush : noop;
      },
      inject: [ConfigService, WebPushProvider, NoopPushProvider],
    },
  ],
  exports: [NotificationsService, MailService, PayslipEmailService],
})
export class NotificationsModule {}
