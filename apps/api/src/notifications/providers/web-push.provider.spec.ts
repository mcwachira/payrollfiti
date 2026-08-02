import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import webpush from 'web-push';
import { WebPushProvider } from './web-push.provider';

jest.mock('web-push');
const mockedWebpush = webpush as jest.Mocked<typeof webpush>;

const asyncMock = (value: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

describe('WebPushProvider', () => {
  let provider: WebPushProvider;
  let configService: { get: jest.Mock };
  let prisma: {
    pushSubscription: {
      findMany: ReturnType<typeof asyncMock>;
      delete: ReturnType<typeof asyncMock>;
    };
  };

  const subscription = {
    id: 'sub-1',
    endpoint: 'https://push.example.com/abc',
    p256dh: 'p256dh-key',
    auth: 'auth-secret',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService = { get: jest.fn() };
    prisma = {
      pushSubscription: {
        findMany: asyncMock([]),
        delete: asyncMock(undefined),
      },
    };
    provider = new WebPushProvider(configService as any, prisma as any);
  });

  it('returns a not-configured error when VAPID keys are missing', async () => {
    configService.get.mockReturnValue({});

    const result = await provider.send('user-1', 'Title', 'Body');

    expect(result).toEqual({
      success: false,
      error: 'Push provider not configured',
    });
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('reports failure when the user has no subscriptions', async () => {
    configService.get.mockReturnValue({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:test@example.com',
    });
    prisma.pushSubscription.findMany.mockResolvedValue([]);

    const result = await provider.send('user-1', 'Title', 'Body');

    expect(result).toEqual({
      success: false,
      error: 'No push subscriptions for user',
    });
  });

  it('sends to every subscription and reports success if at least one succeeds', async () => {
    configService.get.mockReturnValue({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:test@example.com',
    });
    prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
    mockedWebpush.sendNotification.mockResolvedValue({} as any);

    const result = await provider.send('user-1', 'Title', 'Body');

    expect(result).toEqual({ success: true });
    expect(mockedWebpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:test@example.com',
      'pub',
      'priv',
    );
    expect(mockedWebpush.sendNotification).toHaveBeenCalledWith(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({ title: 'Title', body: 'Body' }),
    );
  });

  it('deletes a subscription the push service reports as gone (410)', async () => {
    configService.get.mockReturnValue({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:test@example.com',
    });
    prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
    const goneError = Object.assign(new Error('Gone'), { statusCode: 410 });
    mockedWebpush.sendNotification.mockRejectedValue(goneError);

    const result = await provider.send('user-1', 'Title', 'Body');

    expect(result).toEqual({
      success: false,
      error: 'Delivery failed for all subscriptions',
    });
    expect(prisma.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: subscription.id },
    });
  });

  it('keeps a subscription that failed for a reason other than 404/410', async () => {
    configService.get.mockReturnValue({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:test@example.com',
    });
    prisma.pushSubscription.findMany.mockResolvedValue([subscription]);
    const serverError = Object.assign(new Error('Server error'), {
      statusCode: 500,
    });
    mockedWebpush.sendNotification.mockRejectedValue(serverError);

    const result = await provider.send('user-1', 'Title', 'Body');

    expect(result.success).toBe(false);
    expect(prisma.pushSubscription.delete).not.toHaveBeenCalled();
  });
});
