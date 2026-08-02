import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
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
import { PUSH_PROVIDER } from './push-provider.interface';
import { NoopPushProvider } from './providers/noop-push.provider';
import { AppConfig } from '../config/configuration';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PayslipsModule,
    BullModule.registerQueue(
      { name: NOTIFICATIONS_QUEUE },
      { name: PAYSLIP_EMAILS_QUEUE },
    ),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MailService,
    PayslipEmailService,
    PayrollReminderService,
    NotificationsProcessor,
    PayslipEmailsProcessor,
    NoopSmsProvider,
    AfricasTalkingSmsProvider,
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
    { provide: PUSH_PROVIDER, useClass: NoopPushProvider },
  ],
  exports: [NotificationsService, MailService, PayslipEmailService],
})
export class NotificationsModule {}
