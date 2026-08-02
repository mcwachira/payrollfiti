import { apiDownload } from './api-client';

export function downloadP10Csv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/p10?period=${encodeURIComponent(period)}`,
    `p10-${period}.csv`,
  );
}

export function downloadNssfRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/nssf-remittance?period=${encodeURIComponent(period)}`,
    `nssf-remittance-${period}.csv`,
  );
}

export function downloadNhifRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/nhif-remittance?period=${encodeURIComponent(period)}`,
    `nhif-shif-remittance-${period}.csv`,
  );
}

export function downloadP9(
  companyId: string,
  employeeId: string,
  taxYear: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/p9?employeeId=${encodeURIComponent(employeeId)}&taxYear=${encodeURIComponent(taxYear)}`,
    `p9-${employeeId}-${taxYear}.pdf`,
  );
}

// --- Nigeria ---

export function downloadPayeRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/paye-remittance?period=${encodeURIComponent(period)}`,
    `paye-remittance-${period}.csv`,
  );
}

export function downloadPensionRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/pension-remittance?period=${encodeURIComponent(period)}`,
    `pension-remittance-${period}.csv`,
  );
}

export function downloadNhfRemittanceCsv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/nhf-remittance?period=${encodeURIComponent(period)}`,
    `nhf-remittance-${period}.csv`,
  );
}

// --- South Africa ---

export function downloadEmp201Csv(
  companyId: string,
  period: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/emp201?period=${encodeURIComponent(period)}`,
    `emp201-${period}.csv`,
  );
}

export function downloadIrp5(
  companyId: string,
  employeeId: string,
  taxYear: string,
): Promise<void> {
  return apiDownload(
    `/companies/${companyId}/compliance-reports/irp5?employeeId=${encodeURIComponent(employeeId)}&taxYear=${encodeURIComponent(taxYear)}`,
    `irp5-${employeeId}-${taxYear}.pdf`,
  );
}
