import { apiFetch } from './api-client';

export type ComplianceReportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ComplianceReport {
  id: string;
  companyId: string;
  payrollRunId: string | null;
  country: string;
  reportCode: string;
  reportVersion: string;
  status: ComplianceReportStatus;
  generatedAt: string | null;
  rows: Record<string, unknown>[];
  totals: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}

export function listComplianceReports(
  companyId?: string,
): Promise<ComplianceReport[]> {
  const qs = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
  return apiFetch<ComplianceReport[]>(`/v1/compliance/reports${qs}`);
}

export function getComplianceReport(id: string): Promise<ComplianceReport> {
  return apiFetch<ComplianceReport>(`/v1/compliance/reports/${id}`);
}

export function generateComplianceReport(input: {
  companyId: string;
  payrollRunId: string;
  country: string;
  reportCode: string;
  reportVersion: string;
}): Promise<ComplianceReport> {
  return apiFetch<ComplianceReport>('/v1/compliance/reports', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function generateComplianceForPayrollRun(
  payrollRunId: string,
  input: {
    country: string;
    reportCode: string;
    reportVersion: string;
  },
): Promise<ComplianceReport> {
  return apiFetch<ComplianceReport>(
    `/v1/payroll/runs/${payrollRunId}/compliance`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}
