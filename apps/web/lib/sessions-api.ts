import { apiFetch } from './api-client';

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export function listSessions(): Promise<Session[]> {
  return apiFetch<Session[]>('/account/sessions');
}

export function revokeSession(id: string): Promise<void> {
  return apiFetch<void>(`/account/sessions/${id}`, { method: 'DELETE' });
}

export function revokeOtherSessions(): Promise<void> {
  return apiFetch<void>('/account/sessions/others', { method: 'DELETE' });
}
