import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { usePushNotifications } from '@/lib/push/use-push-notifications';

// The compiled ESM namespace from '@/lib/push-api' is non-configurable, so
// jest.spyOn/jest.mock can't stub it directly — this mocks fetch itself
// instead (same approach test/page.spec.tsx uses), which push-api.ts's
// apiFetch() ultimately calls.
function mockFetch(
  handler: (
    url: string,
    init?: RequestInit,
  ) => { status: number; body?: unknown },
) {
  window.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
    const { status, body } = handler(String(url), init);
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  }) as unknown as typeof fetch;
}

function mockServiceWorker(subscription: unknown) {
  const pushManager = {
    getSubscription: jest
      .fn<() => Promise<unknown>>()
      .mockResolvedValue(subscription),
    subscribe: jest.fn<() => Promise<unknown>>(),
  };
  const registration = { pushManager };
  Object.defineProperty(window.navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
  return pushManager;
}

describe('usePushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });
  });

  it('reports unsupported when the browser has no Push API', () => {
    Object.defineProperty(window, 'PushManager', {
      value: undefined,
      configurable: true,
    });

    const { result } = renderHook(() => usePushNotifications());

    expect(result.current.support).toBe('unsupported');
  });

  it('reflects an existing subscription on mount', async () => {
    mockServiceWorker({ endpoint: 'https://push.example.com/existing' });

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => expect(result.current.support).toBe('ready'));
    await waitFor(() => expect(result.current.subscribed).toBe(true));
  });

  it('subscribes: requests permission, fetches the VAPID key, and registers with the backend', async () => {
    const pushManager = mockServiceWorker(null);
    const subscriptionJson = {
      endpoint: 'https://push.example.com/new',
      keys: { p256dh: 'key', auth: 'secret' },
    };
    pushManager.subscribe.mockResolvedValue({
      toJSON: () => subscriptionJson,
    });
    (window as any).Notification = {
      requestPermission: jest
        .fn<() => Promise<string>>()
        .mockResolvedValue('granted'),
    };
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    mockFetch((url, init) => {
      fetchCalls.push({ url, init });
      if (url.endsWith('/push-subscriptions/vapid-public-key')) {
        return { status: 200, body: { publicKey: 'BPg-xiYYJD_LW76p5e-E0Ln' } };
      }
      return { status: 204 };
    });

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.support).toBe('ready'));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(pushManager.subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true }),
    );
    expect(
      fetchCalls.some((c) =>
        c.url.endsWith('/push-subscriptions/vapid-public-key'),
      ),
    ).toBe(true);
    const subscribeCall = fetchCalls.find(
      (c) => c.url.endsWith('/push-subscriptions') && c.init?.method === 'POST',
    );
    expect(JSON.parse(subscribeCall?.init?.body as string)).toMatchObject({
      endpoint: subscriptionJson.endpoint,
      keys: subscriptionJson.keys,
    });
    expect(result.current.subscribed).toBe(true);
  });

  it('throws instead of subscribing when permission is denied', async () => {
    const pushManager = mockServiceWorker(null);
    (window as any).Notification = {
      requestPermission: jest
        .fn<() => Promise<string>>()
        .mockResolvedValue('denied'),
    };
    mockFetch(() => ({ status: 200, body: {} }));

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.support).toBe('ready'));

    await expect(
      act(async () => {
        await result.current.subscribe();
      }),
    ).rejects.toThrow('Notification permission was not granted');
    expect(pushManager.subscribe).not.toHaveBeenCalled();
  });

  it('unsubscribes an existing subscription both locally and on the backend', async () => {
    const unsubscribeMock = jest
      .fn<() => Promise<boolean>>()
      .mockResolvedValue(true);
    mockServiceWorker({
      endpoint: 'https://push.example.com/existing',
      unsubscribe: unsubscribeMock,
    });
    const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
    mockFetch((url, init) => {
      fetchCalls.push({ url, init });
      return { status: 204 };
    });

    const { result } = renderHook(() => usePushNotifications());
    await waitFor(() => expect(result.current.subscribed).toBe(true));

    await act(async () => {
      await result.current.unsubscribe();
    });

    expect(unsubscribeMock).toHaveBeenCalled();
    const deleteCall = fetchCalls.find(
      (c) =>
        c.url.endsWith('/push-subscriptions') && c.init?.method === 'DELETE',
    );
    expect(JSON.parse(deleteCall?.init?.body as string)).toEqual({
      endpoint: 'https://push.example.com/existing',
    });
    expect(result.current.subscribed).toBe(false);
  });
});
