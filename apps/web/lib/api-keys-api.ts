import { apiFetch } from './api-client';

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdById: string | null;
  createdAt: string;
}

export function listApiKeys(): Promise<ApiKey[]> {
  return apiFetch<ApiKey[]>('/api-keys');
}

export function createApiKey(
  name: string,
): Promise<{ apiKey: ApiKey; rawKey: string }> {
  return apiFetch<{ apiKey: ApiKey; rawKey: string }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function revokeApiKey(id: string): Promise<void> {
  return apiFetch<void>(`/api-keys/${id}`, { method: 'DELETE' });
}
