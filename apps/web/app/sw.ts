/// <reference lib="webworker" />

// Runs in the ServiceWorkerGlobalScope, not the DOM — excluded from the
// app's tsconfig (see tsconfig.json) since that scope conflicts with the
// rest of the app's "DOM" lib. Next.js/Serwist transpile and bundle this
// file directly at build time; it never goes through the app's `tsc` check.
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: '/offline',
        matcher({ request }) {
          return request.destination === 'document';
        },
      },
    ],
  },
});

serwist.addEventListeners();

interface PushPayload {
  title: string;
  body: string;
}

// Serwist only handles caching/offline; the push channel itself is plain
// Web Push (see WebPushProvider on the API side) and isn't something
// Serwist wires up on its own.
self.addEventListener('push', (event) => {
  const payload: PushPayload = event.data?.json() ?? {
    title: 'PayrollFiti',
    body: 'You have a new notification',
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    }),
  );
});

// Focuses an already-open app tab rather than always opening a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((client) => 'focus' in client);
        if (existing) return (existing as WindowClient).focus();
        return self.clients.openWindow('/');
      }),
  );
});
