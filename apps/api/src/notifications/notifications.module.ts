import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsProcessor } from './notifications.processor';
import { MailService } from './mail.service';
import { PayslipEmailService } from './payslip-email.service';
import { PayrollReminderService } from './payroll-reminder.service';
import { PayslipsModule } from '../payslips/payslips.module';
import { NOTIFICATIONS_QUEUE } from './notifications.queue';
import { SMS_PROVIDER } from './sms-provider.interface';
import { NoopSmsProvider } from './providers/noop-sms.provider';
import { PUSH_PROVIDER } from './push-provider.interface';
import { NoopPushProvider } from './providers/noop-push.provider';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PayslipsModule,
    BullModule.registerQueue({ name: NOTIFICATIONS_QUEUE }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MailService,
    PayslipEmailService,
    PayrollReminderService,
    NotificationsProcessor,
    { provide: SMS_PROVIDER, useClass: NoopSmsProvider },
    { provide: PUSH_PROVIDER, useClass: NoopPushProvider },
  ],
  exports: [NotificationsService, MailService, PayslipEmailService],
})
export class NotificationsModule {}
