'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  getVapidPublicKey,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-api';

export type PushSupportState = 'checking' | 'unsupported' | 'ready';

/** applicationServerKey needs a Uint8Array; the backend hands us the VAPID key base64url-encoded. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Owns the browser-side half of Web Push: checking support, reflecting the
 * current subscription state, and subscribing/unsubscribing through the
 * service worker's PushManager. The service worker itself (app/sw.ts)
 * handles the incoming `push` event once a subscription exists.
 */
export function usePushNotifications() {
  const [support, setSupport] = useState<PushSupportState>('checking');
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupport('unsupported');
      return;
    }
    setSupport('ready');

    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(subscription !== null))
      .catch(() => setSubscribed(false));
  }, []);

  const subscribe = useCallback(async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission was not granted');
      }

      const publicKey = await getVapidPublicKey();
      if (!publicKey) {
        throw new Error('Push notifications are not configured on the server');
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await subscribeToPush(subscription.toJSON() as PushSubscriptionJSON);
      setSubscribed(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await unsubscribeFromPush(subscription.endpoint);
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return { support, subscribed, busy, subscribe, unsubscribe };
}
