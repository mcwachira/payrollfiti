export const PAYSLIP_EMAILS_QUEUE = 'payslip-emails';
export const PAYSLIP_EMAILS_DELIVER_JOB = 'deliver-for-run';

export interface PayslipEmailsJobData {
  tenantId: string;
  payrollRunId: string;
}
