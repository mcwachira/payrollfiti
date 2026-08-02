# Part 14 — Progressive Web App: Install, Manifest & Push

Part 10 §10.7 wired up the baseline: a real service worker via `@serwist/next`, precaching, and an `/offline` fallback page. That made the app *installable* in the technical sense, but three things were still missing before it was actually usable as an app: nothing ever prompted a user to install it, nobody had checked whether the manifest/icons were complete rather than placeholder, and — the biggest gap — `PUSH_PROVIDER` was bound to a no-op stub, so every "send push notification" call in the system trivially succeeded without any device ever receiving anything. This part builds all three, in that order.

## 14.1 Manifest & Icons — Auditing What's There

Before adding anything, the existing manifest and icon set turned out to already be complete — worth showing, since "audit first, build second" applies as much to documentation as to code:

```typescript
// app/manifest.ts
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#e11d48',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
```

That covers both required icon purposes — `any` (rendered as-is) and `maskable` (safe-zone padding so Android can crop it into a circle/squircle without clipping content) — plus a 180×180 `apple-touch-icon.png` wired through `layout.tsx`'s `metadata.icons.apple` for iOS home-screen icons, which the web manifest spec doesn't cover on its own. Nothing to add here; the gap was entirely in the two sections below.

## 14.2 The Install Prompt

Chrome/Edge/Android fire a `beforeinstallprompt` event that a page can capture and defer, then trigger later from its own UI instead of relying on the browser's native (and easy-to-miss) install icon. iOS Safari never fires that event at all — "Add to Home Screen" there is Share-sheet-only — so the same component branches into static instructions instead of pretending the two platforms work the same way:

```typescript
// components/pwa/InstallPrompt.tsx
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    setDismissed(false);

    if (isIos()) { setShowIosInstructions(true); return; }

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // suppress the browser's own prompt — trigger ours instead
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setDismissed(true);
      window.localStorage.removeItem(DISMISS_KEY);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') window.localStorage.removeItem(DISMISS_KEY);
    else dismiss();
  };
  // ...renders a dismissible bottom banner; dismiss() stamps DISMISS_KEY with Date.now()
}
```

Two guards keep the banner from being annoying: `isStandalone()` (checks `matchMedia('(display-mode: standalone)')` and iOS's non-standard `navigator.standalone`) hides it entirely once already installed, and a dismissal is remembered in `localStorage` for 14 days rather than reappearing on every visit. Mounted once, globally, in the root layout:

```typescript
// app/layout.tsx
<Toaster />
<InstallPrompt />
```

## 14.3 Web Push — Backend

This is the part that was previously entirely fake. `PushProvider` is the same extension-point pattern as `SmsProvider`/`AccountingProvider` — an interface plus a `NoopPushProvider` default — but until now nothing had ever implemented it for real:

```typescript
// notifications/push-provider.interface.ts
export interface PushProvider {
  readonly name: string;
  send(userId: string, title: string, body: string): Promise<PushSendResult>;
}
```

Real delivery needs two things the interface alone doesn't provide: a place to store *which* browsers/devices a user has subscribed (a user with two tabs open on two phones has two subscriptions), and VAPID keys to sign the push messages per RFC 8292.

```prisma
// prisma/schema.prisma
// One row per subscribed browser/device. endpoint is the push service's
// per-subscription URL, unique by construction; p256dh/auth are the
// subscription's public key and auth secret, both required to encrypt a
// push message per the Web Push protocol (RFC 8291).
model PushSubscription {
  id        String   @id @default(uuid())
  tenantId  String
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}
```

```typescript
// notifications/providers/web-push.provider.ts
@Injectable()
export class WebPushProvider implements PushProvider {
  readonly name = 'web-push';

  async send(userId: string, title: string, body: string): Promise<PushSendResult> {
    const config = this.configService.get('vapid', { infer: true });
    if (!config.publicKey || !config.privateKey) {
      return { success: false, error: 'Push provider not configured' };
    }

    // Unlike SmsProvider.send(to, ...), there's no destination address to
    // hand in — a user can have any number of subscribed devices, so this
    // provider owns its own recipient lookup rather than taking one.
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) return { success: false, error: 'No push subscriptions for user' };

    webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    const payload = JSON.stringify({ title, body });

    const results = await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          payload,
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // The push service reporting a subscription as gone (browser
        // uninstalled, permission revoked) — prune it so it isn't retried
        // forever, rather than treating it as a transient failure.
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        }
        return false;
      }
    }));

    return results.some(Boolean) ? { success: true } : { success: false, error: 'Delivery failed for all subscriptions' };
  }
}
```

Wired in with the exact same config-gated factory pattern as `SMS_PROVIDER` (Part 8 §8.4) — inert (`NoopPushProvider`) until `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are set, real (`WebPushProvider`) once they are, with nothing else in the codebase needing to change either way:

```typescript
// notifications/notifications.module.ts
{
  provide: PUSH_PROVIDER,
  useFactory: (configService: ConfigService<AppConfig, true>, webPush: WebPushProvider, noop: NoopPushProvider): PushProvider => {
    const config = configService.get('vapid', { infer: true });
    return config.publicKey && config.privateKey ? webPush : noop;
  },
  inject: [ConfigService, WebPushProvider, NoopPushProvider],
},
```

The frontend needs somewhere to register a subscription and a way to fetch the (non-secret, by design) VAPID public key it needs to call `PushManager.subscribe()`:

```typescript
// notifications/push-subscriptions.controller.ts
@Controller('push-subscriptions')
export class PushSubscriptionsController {
  @Get('vapid-public-key')
  getVapidPublicKey(): { publicKey: string | null } {
    const { publicKey } = this.configService.get('vapid', { infer: true });
    return { publicKey: publicKey ?? null };
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  subscribe(@CurrentUser() user: AuthenticatedRequestUser, @Body() dto: SubscribePushDto) {
    // Upsert by endpoint: a browser re-subscribing (e.g. after the push
    // service rotates it) should update the existing row, not duplicate it.
    return this.notificationsService.subscribeToPush(user.tenantId, user.id, dto.endpoint, dto.keys, dto.userAgent);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  unsubscribe(@CurrentUser() user: AuthenticatedRequestUser, @Body() dto: UnsubscribePushDto) {
    return this.notificationsService.unsubscribeFromPush(user.id, dto.endpoint);
  }
}
```

## 14.4 Web Push — Frontend & the Service Worker

`usePushNotifications()` owns the browser-side half: checking support, reflecting whether the current device is already subscribed, and the subscribe/unsubscribe round-trip through the service worker's `PushManager`:

```typescript
// lib/push/use-push-notifications.ts
export function usePushNotifications() {
  const [support, setSupport] = useState<PushSupportState>('checking');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupport('unsupported');
      return;
    }
    setSupport('ready');
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setSubscribed(subscription !== null));
  }, []);

  const subscribe = useCallback(async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted');

    const publicKey = await getVapidPublicKey();
    if (!publicKey) throw new Error('Push notifications are not configured on the server');

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey), // PushManager needs a Uint8Array, not the base64url string the API returns
    });
    await subscribeToPush(subscription.toJSON() as PushSubscriptionJSON);
    setSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await unsubscribeFromPush(subscription.endpoint);
    }
    setSubscribed(false);
  }, []);

  return { support, subscribed, subscribe, unsubscribe };
}
```

Exposed as a bell icon in `AppHeader` — visible to every authenticated user, admin/HR and employee alike, since they share the same layout — that flips between "enable" and "turn off" based on `subscribed`.

None of the above makes anything actually *appear* when a push arrives, though — `Serwist` only handles caching/offline; the push channel itself needed its own event listeners added straight to the same service worker file from Part 10 §10.7:

```typescript
// app/sw.ts
serwist.addEventListeners();

self.addEventListener('push', (event) => {
  const payload = event.data?.json() ?? { title: 'PayrollFiti', body: 'You have a new notification' };
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
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => 'focus' in client);
      return existing ? (existing as WindowClient).focus() : self.clients.openWindow('/');
    }),
  );
});
```

End to end, the same shape as every other integration in this system: `NOTIFICATION_DELIVER_JOB` (Part 8 §8.2) calls `pushProvider.send(userId, title, body)` exactly as it already did when the provider was a no-op — `WebPushProvider` looks up that user's subscriptions, `webpush.sendNotification()` hands the encrypted payload to the browser's push service, and `app/sw.ts`'s `push` listener is what turns that into something the user actually sees. Generate a keypair once with `npx web-push generate-vapid-keys`, set `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, and every existing `dispatch(..., { channels: [NotificationChannel.PUSH] })` call site starts delivering for real — no call site anywhere else in the codebase needed to change.

This closes the guide's account of the frontend as an installable, notification-capable app. Combined with Part 13's authentication chain and Part 12's environment reference, `docs/PayrollFiti-Complete-Build-Guide.pdf` now describes the system as it actually runs, end to end: an `ADMIN` signing up, inviting `HR` and `EMPLOYEE` users into a single shared login, every one of them able to install the app to their home screen and receive a real push notification when a payroll run completes or a leave request needs a decision.
