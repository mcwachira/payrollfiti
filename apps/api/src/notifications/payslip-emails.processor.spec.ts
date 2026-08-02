import { describe, it, expect, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { PayslipEmailsProcessor } from './payslip-emails.processor';
import { PayslipEmailsJobData } from './payslip-emails.queue';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

const makeJob = (data: PayslipEmailsJobData): Job<PayslipEmailsJobData> =>
  ({ data }) as Job<PayslipEmailsJobData>;

describe('PayslipEmailsProcessor', () => {
  it('delegates to PayslipEmailService.sendPayslipEmailsForRun with the job data', async () => {
    const payslipEmailService = {
      sendPayslipEmailsForRun: asyncMock(undefined),
    };
    const processor = new PayslipEmailsProcessor(
      payslipEmailService as any,
    );

    await processor.process(
      makeJob({ tenantId: 'tenant-1', payrollRunId: 'run-1' }),
    );

    expect(
      payslipEmailService.sendPayslipEmailsForRun,
    ).toHaveBeenCalledWith('tenant-1', 'run-1');
  });
});
