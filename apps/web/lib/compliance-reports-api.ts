import { apiDownload } from './api-client';

export function downloadP10Csv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/p10?period=${encodeURIComponent(period)}`,
    `p10-${period}.csv`,
  );
}

export function downloadNssfRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/nssf-remittance?period=${encodeURIComponent(period)}`,
    `nssf-remittance-${period}.csv`,
  );
}

export function downloadNhifRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/nhif-remittance?period=${encodeURIComponent(period)}`,
    `nhif-shif-remittance-${period}.csv`,
  );
}

export function downloadP9(
  companyId: string,
  employeeId: string,
  taxYear: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/p9?employeeId=${encodeURIComponent(employeeId)}&taxYear=${encodeURIComponent(taxYear)}`,
    `p9-${employeeId}-${taxYear}.pdf`,
  );
}

// --- Nigeria ---

export function downloadPayeRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/paye-remittance?period=${encodeURIComponent(period)}`,
    `paye-remittance-${period}.csv`,
  );
}

export function downloadPensionRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/pension-remittance?period=${encodeURIComponent(period)}`,
    `pension-remittance-${period}.csv`,
  );
}

export function downloadNhfRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/nhf-remittance?period=${encodeURIComponent(period)}`,
    `nhf-remittance-${period}.csv`,
  );
}

// --- South Africa ---

export function downloadEmp201Csv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/emp201?period=${encodeURIComponent(period)}`,
    `emp201-${period}.csv`,
  );
}

export function downloadIrp5(
  companyId: string,
  employeeId: string,
  taxYear: string,
): Promise<void> {
  return apiDownload(
    `/v1/compliance/reports/companies/${companyId}/irp5?employeeId=${encodeURIComponent(employeeId)}&taxYear=${encodeURIComponent(taxYear)}`,
    `irp5-${employeeId}-${taxYear}.pdf`,
  );
}
