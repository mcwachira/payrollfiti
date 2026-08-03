import { describe, it, expect, jest } from '@jest/globals';
import { Job } from 'bullmq';
import { PayslipEmailsProcessor } from './payslip-emails.processor';
import { PayslipEmailsJobData } from './payslip-emails.queue';

const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

const makeJob = (data: PayslipEmailsJobData): Job<PayslipEmailsJobData> =>
  ({ data }) as Job<PayslipEmailsJobData>;

describe('PayslipEmailsProcessor', () => {
  it('delegates to PayslipEmailService.sendPayslipEmail with the job data', async () => {
    const payslipEmailService = {
      sendPayslipEmail: asyncMock(undefined),
    };
    const processor = new PayslipEmailsProcessor(payslipEmailService as any);

    await processor.process(
      makeJob({ tenantId: 'tenant-1', payrollEntryId: 'entry-1' }),
    );

    expect(payslipEmailService.sendPayslipEmail).toHaveBeenCalledWith(
      'tenant-1',
      'entry-1',
    );
  });
});
