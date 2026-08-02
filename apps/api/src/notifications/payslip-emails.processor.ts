import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PayslipEmailService } from './payslip-email.service';
import {
  PAYSLIP_EMAILS_QUEUE,
  PayslipEmailsJobData,
} from './payslip-emails.queue';

/**
 * Consumes jobs enqueued by PayslipEmailService.enqueueForRun() — moves the
 * per-employee payslip PDF render + email loop off the payroll-run request
 * thread. sendPayslipEmailsForRun() itself never throws (see its own
 * comment), so this processor has nothing extra to catch; BullMQ's retry
 * only matters if the process crashes mid-job.
 */
@Processor(PAYSLIP_EMAILS_QUEUE)
export class PayslipEmailsProcessor extends WorkerHost {
  constructor(private readonly payslipEmailService: PayslipEmailService) {
    super();
  }

  async process(job: Job<PayslipEmailsJobData>): Promise<void> {
    const { tenantId, payrollRunId } = job.data;
    await this.payslipEmailService.sendPayslipEmailsForRun(
      tenantId,
      payrollRunId,
    );
  }
}
