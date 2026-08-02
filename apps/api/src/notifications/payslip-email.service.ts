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
   * Enqueues payslip email delivery for every entry in a run, off the
   * payroll-run request thread — see PayslipEmailsProcessor. Call this
   * instead of sendPayslipEmailsForRun() directly from request-handling
   * code; sendPayslipEmailsForRun() is what the queue processor calls.
   */
  async enqueueForRun(tenantId: string, payrollRunId: string): Promise<void> {
    await this.payslipEmailsQueue.add(PAYSLIP_EMAILS_DELIVER_JOB, {
      tenantId,
      payrollRunId,
    });
  }

  /**
   * Never throws — a failure here must never fail the payroll-run HTTP
   * response that triggered it (mirrors AuditService.record / MailService).
   */
  async sendPayslipEmail(
    tenantId: string,
    payrollEntryId: string,
  ): Promise<void> {
    try {
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
    } catch (error) {
      this.logger.error(
        `Failed to send payslip email for entry ${payrollEntryId}`,
        error as Error,
      );
    }
  }

  /**
   * Sequential + awaited in a loop for simplicity. NOTE: for very large
   * companies this adds request latency proportional to headcount —
   * fire-and-forget or a queue is the natural follow-up if that becomes a
   * problem; not built now.
   */
  async sendPayslipEmailsForRun(
    tenantId: string,
    payrollRunId: string,
  ): Promise<void> {
    try {
      const run = await this.prisma.payrollRun.findUnique({
        where: { id: payrollRunId },
        include: { entries: true },
      });
      if (!run) return;

      for (const entry of run.entries) {
        await this.sendPayslipEmail(tenantId, entry.id);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send payslip emails for run ${payrollRunId}`,
        error as Error,
      );
    }
  }
}
