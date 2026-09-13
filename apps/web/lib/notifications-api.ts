import { apiFetch } from './api-client';

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationChannel {
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
}

export interface NotificationPreference {
  event_type: string;
  category: string;
  channels: NotificationChannel;
}

export type NotificationPreferenceInput = Omit<NotificationPreference, 'category'>;

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

export function getNotificationPreferences(): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>('/notification-preferences');
}

export function updateNotificationPreferences(
  input: NotificationPreferenceInput | NotificationPreferenceInput[],
): Promise<NotificationPreference[]> {
  return apiFetch<NotificationPreference[]>('/notification-preferences', {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
