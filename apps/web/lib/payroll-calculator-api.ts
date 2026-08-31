import { apiFetch, ApiError } from './api-client';
import { API_URL } from './config';


export interface SupportedCountry {
  countryCode: string;
  currency: string;
  ruleVersion:string
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


//  LIST SUPPORTED COUNTRIES
//Fetches all countries supported by the public payroll * calculation engine.
//This endpoint is public, so no authentication token * should be attached.
export function listSupportedCountries(): Promise<SupportedCountry[]> {
  return apiFetch<SupportedCountry[]>('/payroll-calculate/countries', {
    skipAuth: true,
  });
}

// CALCULATE PAYROLL
//Sends payroll input to the backend calculation engine * and returns the complete payroll calculation.
//This is also a public endpoint.

export function calculatePayroll(input:CalculatePayrollInput):Promise<PayrollCalculationResult>{
  return apiFetch<PayrollCalculationResult>('/payroll-calculate', {
    method: 'POST',
    body: JSON.stringify(input),
    skipAuth: true,
  })
}


// DOWNLOAD PAYROLL ESTIMATE PDF
// Generates and downloads a PDF version of the payroll estimate.
// This endpoint is public, so no Authorization header is sent.
// Raw fetch() is used instead of apiFetch() because apiFetch()
// expects JSON responses, while this endpoint returns binary * PDF data. */

export async function downloadPayrollEstimatePdf(input:CalculatePayrollInput):Promise<void>{
  // Ask the backend to generate the PDF.
  const response = await fetch(`${API_URL}/payroll-calculate/export/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  // If PDF generation failed, throw the same ApiError type
  if (!response.ok) {
    throw new ApiError(response.status, 'Failed to generate PDF estimate');
  }

  // Convert the response into a Blob.
  // A Blob is how the browser represents binary data
  // such as PDFs, images, ZIP files, etc.
  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  // Create a temporary <a> element.
  // Browsers understand the `download` attribute on
  // anchor elements, so this lets us trigger a download.

  const link = document.createElement('a');
  link.href = url;

  // Generate the filename.
  link.download = `payroll-estimate-${input.country.toUpperCase()}.pdf`;

  // Add the link to the DOM.
  document.body.appendChild(link);

  // Programmatically click the link to start the download.
  link.click();

  // Remove the temporary link.
  link.remove();

  // Release the Blob URL from memory.
  URL.revokeObjectURL(url);
}