import { apiFetch, ApiError } from './api-client';
import { API_URL } from './config';

export interface SupportedCountry {
  countryCode: string;
  currency: string;
  ruleVersion: string;
}

export interface EarningsResult {
  basicSalary: number;
  totalAllowances: number;
  overtimeAmount: number;
  commissionAmount: number;
  bonusAmount: number;
  grossPay: number;
  allowanceBreakdown: Record<string, number>;
}

export interface StatutoryDeductionLine {
  code: string;
  label: string;
  employeeAmount: number;
  employerAmount: number;
}

export interface TaxResult {
  code: string;
  taxableIncome: number;
  grossTax: number;
  relief: number;
  netTax: number;
}

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PayrollCalculationResult {
  countryCode: string;
  currency: string;
  ruleVersion: string;
  earnings: EarningsResult;
  statutoryDeductions: StatutoryDeductionLine[];
  voluntaryDeductions: Record<string, number>;
  totalVoluntaryDeductions: number;
  tax: TaxResult;
  totalDeductions: number;
  grossPay: number;
  netPay: number;
  validation: ValidationIssue[];
}

export interface CalculatePayrollInput {
  country: string;
  salary: number;
  allowances?: Record<string, number>;
  deductions?: Record<string, number>;
}

export function listSupportedCountries(): Promise<SupportedCountry[]> {
  return apiFetch<SupportedCountry[]>('/payroll-calculate/countries', {
    skipAuth: true,
  });
}

export function calculatePayroll(
  input: CalculatePayrollInput,
): Promise<PayrollCalculationResult> {
  return apiFetch<PayrollCalculationResult>('/payroll-calculate', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  });
}

/** Public endpoint — no auth token is sent. */
export async function downloadPayrollEstimatePdf(
  input: CalculatePayrollInput,
): Promise<void> {
  const response = await fetch(`${API_URL}/payroll-calculate/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to generate PDF estimate');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll-estimate-${input.country.toUpperCase()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
