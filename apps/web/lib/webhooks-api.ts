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
  return apiFetch<WebhookEndpoint[]>('/v1/settings/webhook-endpoints');
}

export function createWebhook(input: {
  url: string;
  events: string[];
}): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>('/v1/settings/webhook-endpoints', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateWebhook(
  id: string,
  input: Partial<{ url: string; events: string[]; isActive: boolean }>,
): Promise<WebhookEndpoint> {
  return apiFetch<WebhookEndpoint>(`/v1/settings/webhook-endpoints/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/v1/settings/webhook-endpoints/${id}`, { method: 'DELETE' });
}

export function listWebhookDeliveries(id: string): Promise<WebhookDelivery[]> {
  return apiFetch<WebhookDelivery[]>(`/v1/settings/webhook-endpoints/${id}/delivery-logs`);
}
