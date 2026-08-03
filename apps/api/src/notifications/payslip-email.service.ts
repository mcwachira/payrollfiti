import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { PayslipsService } from '../payslips/payslips.service';
import { MailService } from './mail.service';
import {
  PAYSLIP_EMAILS_DELIVER_JOB,
  PAYSLIP_EMAILS_QUEUE,
} from './payslip-emails.queue';

@Injectable()
export class PayslipEmailService {
  private readonly logger = new Logger(PayslipEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payslipsService: PayslipsService,
    private readonly mailService: MailService,
    @InjectQueue(PAYSLIP_EMAILS_QUEUE)
    private readonly payslipEmailsQueue: Queue,
  ) {}

  /**
   * Enqueues one job per entry in the run, off the payroll-run request
   * thread — see PayslipEmailsProcessor. One job per entry (rather than one
   * job looping over the whole run) lets BullMQ process a run's emails
   * concurrently and retry a single failed entry without resending
   * everyone else's payslip.
   *
   * This method itself must never throw — a failure here must never fail
   * the payroll-run HTTP response that triggered it (mirrors
   * AuditService.record / MailService).
   */
  async enqueueForRun(tenantId: string, payrollRunId: string): Promise<void> {
    try {
      const run = await this.prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
        include: { entries: true },
      });
      if (!run) return;

      await this.payslipEmailsQueue.addBulk(
        run.entries.map((entry) => ({
          name: PAYSLIP_EMAILS_DELIVER_JOB,
          data: { tenantId, payrollEntryId: entry.id },
        })),
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue payslip emails for run ${payrollRunId}`,
        error as Error,
      );
    }
  }

  /**
   * Called only by PayslipEmailsProcessor, one entry per job — lets errors
   * propagate so BullMQ retries just this entry, instead of swallowing them
   * the way enqueueForRun above must.
   */
  async sendPayslipEmail(
    tenantId: string,
    payrollEntryId: string,
  ): Promise<void> {
    const entry = await this.prisma.payrollEntry.findUnique({
      where: { id: payrollEntryId },
      include: {
        employee: { include: { user: true, company: true } },
        payrollRun: true,
      },
    });
    if (!entry || entry.employee.company.tenantId !== tenantId) {
      return;
    }

    const email = entry.employee.user?.email;
    if (!email) {
      // Employee has no linked login — nowhere to send a payslip email.
      return;
    }

    const buffer = await this.payslipsService.generate(
      tenantId,
      payrollEntryId,
    );

    await this.mailService.sendMail(
      email,
      `Your Payslip — ${entry.payrollRun.period}`,
      `<p>Hi ${entry.employee.firstName},</p><p>Your payslip for ${entry.payrollRun.period} is attached.</p>`,
      [{ filename: 'payslip.pdf', content: buffer }],
    );
  }
}
