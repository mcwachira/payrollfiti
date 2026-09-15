import { apiFetch } from './api-client';

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  status: 'active' | 'revoked' | 'expired';
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface ApiKeyCreateResponse extends ApiKey {
  plainSecret: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  status: 'active' | 'paused';
  secret: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryLog {
  id: string;
  webhookEndpointId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  attempts: number;
  lastError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  auditableType: string;
  auditableId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface AccountingConnection {
  id: string;
  provider: 'xero' | 'quickbooks' | 'zoho_books';
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingSyncJob {
  id: string;
  accountingConnectionId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'pending_external';
  startedAt: string | null;
  finishedAt: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function listApiKeys(): Promise<ApiKey[]> {
  return apiFetch<ApiKey[]>('/v1/settings/api-keys');
}

export function createApiKey(input: {
  name: string;
}): Promise<ApiKeyCreateResponse> {
  return apiFetch<ApiKeyCreateResponse>('/v1/settings/api-keys', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function regenerateApiKey(id: string): Promise<ApiKeyCreateResponse> {
  return apiFetch<ApiKeyCreateResponse>(
    `/v1/settings/api-keys/${id}/regenerate`,
    { method: 'POST' },
  );
}

export function deleteApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/v1/settings/api-keys/${id}`, { method: 'DELETE' });
}

export function listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>('/v1/settings/webhook-endpoints');
}

export function createWebhookEndpoint(input: {
  url: string;
  events: string[];
  secret: string;
}): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>('/v1/settings/webhook-endpoints', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWebhookEndpoint(
  id: string,
  input: {
    url?: string;
    events?: string[];
    status?: 'active' | 'paused';
    secret?: string;
  },
): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(
    `/v1/settings/webhook-endpoints/${id}`,
    {
      method: 'PUT',
      body: JSON.stringify(input),
    },
  );
}

export function deleteWebhookEndpoint(id: string): Promise<void> {
  return apiFetch<void>(
    `/v1/settings/webhook-endpoints/${id}`,
    { method: 'DELETE' },
  );
}

export function listWebhookDeliveryLogs(
  id: string,
): Promise<WebhookDeliveryLog[]> {
  return apiFetch<WebhookDeliveryLog[]>(
    `/v1/settings/webhook-endpoints/${id}/delivery-logs`,
  );
}

export function listAuditLogs(): Promise<AuditLog[]> {
  return apiFetch<AuditLog[]>('/v1/settings/audit-logs');
}

export function listAccountingConnections(): Promise<AccountingConnection[]> {
  return apiFetch<AccountingConnection[]>(
    '/v1/settings/accounting/connections',
  );
}

export function createAccountingConnection(input: {
  provider: 'xero' | 'quickbooks' | 'zoho_books';
  name: string;
}): Promise<AccountingConnection> {
  return apiFetch<AccountingConnection>(
    '/v1/settings/accounting/connections',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function deleteAccountingConnection(id: string): Promise<void> {
  return apiFetch<void>(
    `/v1/settings/accounting/connections/${id}`,
    { method: 'DELETE' },
  );
}

export function listAccountingSyncJobs(
  id: string,
): Promise<AccountingSyncJob[]> {
  return apiFetch<AccountingSyncJob[]>(
    `/v1/settings/accounting/connections/${id}/sync-jobs`,
  );
}
