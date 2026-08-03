import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PayslipEmailService } from './payslip-email.service';
import {
  PAYSLIP_EMAILS_QUEUE,
  PayslipEmailsJobData,
} from './payslip-emails.queue';

/**
 * Consumes one job per payslip entry, enqueued by
 * PayslipEmailService.enqueueForRun() — moves the per-employee payslip PDF
 * render + email off the payroll-run request thread. One job per entry (not
 * one job looping over the whole run) means a run's emails send
 * concurrently, up to `concurrency` at a time, and sendPayslipEmail()
 * throwing here fails only that entry's job — BullMQ retries it without
 * resending anyone else's payslip.
 */
@Processor(PAYSLIP_EMAILS_QUEUE, { concurrency: 5 })
export class PayslipEmailsProcessor extends WorkerHost {
  constructor(private readonly payslipEmailService: PayslipEmailService) {
    super();
  }

  async process(job: Job<PayslipEmailsJobData>): Promise<void> {
    const { tenantId, payrollEntryId } = job.data;
    await this.payslipEmailService.sendPayslipEmail(tenantId, payrollEntryId);
  }
}
