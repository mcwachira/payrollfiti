import { readCacheEntry, writeCacheEntry } from './offline-db';

export interface OfflineCacheResult<T> {
  data: T;
  /** True when this came from the last successful fetch's cache, not a live network response */
  fromCache: boolean;
  /** When the cached copy was written; only set when `fromCache` is true */
  cachedAt?: number;
}

/**
 * Read-through cache for "critical data" (profile, payslips) that should
 * still be viewable offline: tries the real fetch first and caches a
 * successful result in IndexedDB; if the fetch fails (offline, network
 * error), falls back to the last cached copy instead of failing the whole
 * view. Rethrows the original error only when there's no cache to fall
 * back on (e.g. first load while offline).
 */
export async function fetchWithOfflineCache<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<OfflineCacheResult<T>> {
  try {
    const data = await fetcher();
    await writeCacheEntry(key, data);
    return { data, fromCache: false };
  } catch (error) {
    const cached = await readCacheEntry<T>(key);
    if (cached) {
      return { data: cached.data, fromCache: true, cachedAt: cached.cachedAt };
    }
    throw error;
  }
}
