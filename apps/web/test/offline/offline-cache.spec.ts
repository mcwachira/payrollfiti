import 'fake-indexeddb/auto';
import { describe, it, expect, jest } from '@jest/globals';

// jsdom's test environment doesn't expose the `structuredClone` global that
// fake-indexeddb's IDBObjectStore.put uses to clone values on write.
globalThis.structuredClone ??= ((value: unknown) =>
  JSON.parse(JSON.stringify(value))) as typeof structuredClone;

import { fetchWithOfflineCache } from '@/lib/offline/offline-cache';

describe('fetchWithOfflineCache', () => {
  it('caches a successful fetch and returns it as fresh (fromCache: false)', async () => {
    const fetcher = jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'a' });

    const result = await fetchWithOfflineCache('test:success', fetcher);

    expect(result).toEqual({ data: { id: 'a' }, fromCache: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('falls back to the cached value when the fetch fails', async () => {
    const okFetcher = jest.fn<() => Promise<{ id: string }>>().mockResolvedValue({ id: 'b' });
    await fetchWithOfflineCache('test:fallback', okFetcher);

    const failingFetcher = jest
      .fn<() => Promise<{ id: string }>>()
      .mockRejectedValue(new Error('network error'));

    const result = await fetchWithOfflineCache('test:fallback', failingFetcher);

    expect(result.fromCache).toBe(true);
    expect(result.data).toEqual({ id: 'b' });
    expect(result.cachedAt).toEqual(expect.any(Number));
  });

  it('rethrows the original error when there is no cached value to fall back on', async () => {
    const error = new Error('offline, nothing cached');
    const failingFetcher = jest.fn<() => Promise<unknown>>().mockRejectedValue(error);

    await expect(
      fetchWithOfflineCache('test:no-cache-yet', failingFetcher),
    ).rejects.toThrow('offline, nothing cached');
  });

  it('overwrites a stale cached value with a fresh successful fetch', async () => {
    const firstFetcher = jest.fn<() => Promise<{ v: number }>>().mockResolvedValue({ v: 1 });
    await fetchWithOfflineCache('test:overwrite', firstFetcher);

    const secondFetcher = jest.fn<() => Promise<{ v: number }>>().mockResolvedValue({ v: 2 });
    const result = await fetchWithOfflineCache('test:overwrite', secondFetcher);

    expect(result).toEqual({ data: { v: 2 }, fromCache: false });
  });
});
