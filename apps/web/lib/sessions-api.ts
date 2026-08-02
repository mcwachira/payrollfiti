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
  return apiFetch<Session[]>('/auth/sessions');
}

export function revokeSession(id: string): Promise<void> {
  return apiFetch<void>(`/auth/sessions/${id}`, { method: 'DELETE' });
}
