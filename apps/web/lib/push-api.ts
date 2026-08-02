import { apiFetch } from './api-client';

interface VapidPublicKeyResponse {
  publicKey: string | null;
}

export async function getVapidPublicKey(): Promise<string | null> {
  const { publicKey } = await apiFetch<VapidPublicKeyResponse>(
    '/push-subscriptions/vapid-public-key',
  );
  return publicKey;
}

export function subscribeToPush(
  subscription: PushSubscriptionJSON,
): Promise<void> {
  return apiFetch<void>('/push-subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: navigator.userAgent,
    }),
  });
}

export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return apiFetch<void>('/push-subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
