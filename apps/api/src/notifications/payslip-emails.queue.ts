export const PAYSLIP_EMAILS_QUEUE = 'payslip-emails';
export const PAYSLIP_EMAILS_DELIVER_JOB = 'deliver-for-entry';

export interface PayslipEmailsJobData {
  tenantId: string;
  payrollEntryId: string;
}
