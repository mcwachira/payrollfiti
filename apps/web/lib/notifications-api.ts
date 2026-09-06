import {apiFetch} from "@/lib/api-client"

export interface Notification {
  id:string,
  title: string,
  message: string,
  read:Boolean,
  metadata:Record<string, unknown> |null;
  createdAt:string;
}

export function listNotifications(unreadOnly =false):Promise<Notification[]>{
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