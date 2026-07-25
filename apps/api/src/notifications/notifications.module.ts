import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { MailService } from './mail.service';
import { PayslipEmailService } from './payslip-email.service';
import { PayrollReminderService } from './payroll-reminder.service';
import { PayslipsModule } from '../payslips/payslips.module';

@Module({
  imports: [ScheduleModule.forRoot(), PayslipsModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MailService,
    PayslipEmailService,
    PayrollReminderService,
  ],
  exports: [NotificationsService, MailService, PayslipEmailService],
})
export class NotificationsModule {}
