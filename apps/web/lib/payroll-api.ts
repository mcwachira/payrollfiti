import { apiFetch, apiDownload } from './api-client';

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
  };
  currency: string;
  grossPay: number;
  totalTax: number;
  totalStatutoryDeductions: number;
  totalVoluntaryDeductions: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollRunTotals {
  employeeCount: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  countryCode: string;
  currency: string;
  ruleVersion: string;
  status: 'DRAFT' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totals: PayrollRunTotals | null;
  isOffCycle: boolean;
  createdAt: string;
}

export interface PayrollRunDetail extends PayrollRun {
  entries: PayrollEntry[];
}

export interface RunPayrollInput {
  companyId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  force?: boolean;
}

export function listPayrollRuns(companyId: string): Promise<PayrollRun[]> {
  return apiFetch<PayrollRun[]>(
    `/payroll-runs?companyId=${encodeURIComponent(companyId)}`,
  );
}

export function getPayrollRun(id: string): Promise<PayrollRunDetail> {
  return apiFetch<PayrollRunDetail>(`/payroll-runs/${id}`);
}

export function runPayroll(input: RunPayrollInput): Promise<PayrollRunDetail> {
  return apiFetch<PayrollRunDetail>('/payroll-runs', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function downloadPayslip(payrollEntryId: string): Promise<void> {
  return apiDownload(
    `/payslips/${payrollEntryId}`,
    `payslip-${payrollEntryId}.pdf`,
  );
}

export interface MyPayrollEntry {
  id: string;
  currency: string;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  payrollRun: {
    period: string;
    periodStart: string;
    periodEnd: string;
  };
}

/** The current user's own payslip history — no admin/HR role required */
export function getMyPayrollEntries(): Promise<MyPayrollEntry[]> {
  return apiFetch<MyPayrollEntry[]>('/payroll-runs/mine');
}

export function downloadBankExport(
  payrollRunId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/payroll-runs/${payrollRunId}/bank-export`,
    `bank-export-${period}.csv`,
  );
}
