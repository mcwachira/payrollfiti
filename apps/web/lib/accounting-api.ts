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
  return apiFetch<AccountingIntegrationStatus[]>('/v1/settings/accounting/connections');
}

export async function getAccountingConnectUrl(
  provider: AccountingProviderId,
): Promise<string> {
  const { authorizeUrl } = await apiFetch<{ authorizeUrl: string }>(
    `/v1/settings/accounting/connections/${provider}/oauth/redirect`,
  );
  return authorizeUrl;
}

export function disconnectAccountingIntegration(
  provider: AccountingProviderId,
): Promise<void> {
  return apiFetch<void>(`/v1/settings/accounting/connections/${provider}`, {
    method: 'DELETE',
  });
}
