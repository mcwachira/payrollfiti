import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PayrollRunStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

function currentPeriod(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

/**
 * The only scheduled job in the system. Runs at 08:00 on the 1st of every
 * month and nudges ADMIN/HR for any company that hasn't completed a payroll
 * run for the current period yet.
 */
@Injectable()
export class PayrollReminderService {
  private readonly logger = new Logger(PayrollReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 8 1 * *')
  async remindPayrollDue(): Promise<void> {
    try {
      const period = currentPeriod();
      const companies = await this.prisma.company.findMany({
        include: { tenant: true },
      });

      for (const company of companies) {
        const completedRun = await this.prisma.payrollRun.findFirst({
          where: {
            companyId: company.id,
            period,
            status: PayrollRunStatus.COMPLETED,
          },
        });
        if (completedRun) continue;

        await this.notificationsService.createForRoles(
          company.tenant.id,
          [Role.ADMIN, Role.HR],
          'PAYROLL_DUE',
          `Payroll for ${period} has not been run yet.`,
        );
      }
    } catch (error) {
      this.logger.error(
        'Failed to run payroll-due reminder job',
        error as Error,
      );
    }
  }
}
