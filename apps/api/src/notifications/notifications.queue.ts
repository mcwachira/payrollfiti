import { NotificationChannel } from './notification-channel.enum';

export const NOTIFICATIONS_QUEUE = 'notifications';
export const NOTIFICATION_DELIVER_JOB = 'deliver';

export interface NotificationDeliverJobData {
  tenantId: string;
  userId: string;
  type: string;
  message: string;
  metadata?: Record<string, unknown>;
  channels: NotificationChannel[];
}
