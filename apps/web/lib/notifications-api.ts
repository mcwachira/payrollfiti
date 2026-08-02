import { apiFetch } from './api-client';

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export function listNotifications(unreadOnly = false): Promise<Notification[]> {
  return apiFetch<Notification[]>(
    `/notifications${unreadOnly ? '?unreadOnly=true' : ''}`,
  );
}

export function markNotificationRead(id: string): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export function markAllNotificationsRead(): Promise<void> {
  return apiFetch<void>('/notifications/read-all', { method: 'POST' });
}
