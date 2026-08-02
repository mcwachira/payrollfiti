import { apiFetch } from './api-client';

export const WEBHOOK_EVENTS = [
  'payroll.run.completed',
  'invoice.paid',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface WebhookEndpoint {
  id: string;
  url: string;
  secret: string; // masked (whsec_...xxxx) everywhere except the create response
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  statusCode: number | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

export function listWebhooks(): Promise<WebhookEndpoint[]> {
  return apiFetch<WebhookEndpoint[]>('/webhooks');
}

export function createWebhook(input: {
  url: string;
  events: string[];
}): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWebhook(
  id: string,
  input: Partial<{ url: string; events: string[]; isActive: boolean }>,
): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(`/webhooks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/webhooks/${id}`, { method: 'DELETE' });
}

export function listWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  return apiFetch<WebhookDelivery[]>(`/webhooks/${id}/deliveries`);
}
