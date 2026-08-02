import { apiFetch } from './api-client';

export type AccountingProviderId = 'QUICKBOOKS' | 'XERO' | 'ZOHO_BOOKS';

export interface AccountingIntegrationStatus {
  provider: AccountingProviderId;
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
}

export function listAccountingIntegrations(): Promise<
  AccountingIntegrationStatus[]
> {
  return apiFetch<AccountingIntegrationStatus[]>('/accounting/integrations');
}

export async function getAccountingConnectUrl(
  provider: AccountingProviderId,
): Promise<string> {
  const { authorizeUrl } = await apiFetch<{ authorizeUrl: string }>(
    `/accounting/integrations/${provider}/connect`,
  );
  return authorizeUrl;
}

export function disconnectAccountingIntegration(
  provider: AccountingProviderId,
): Promise<void> {
  return apiFetch<void>(`/accounting/integrations/${provider}`, {
    method: 'DELETE',
  });
}
