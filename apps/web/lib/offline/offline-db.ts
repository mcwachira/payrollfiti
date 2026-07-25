import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

interface CacheEntry {
  key: string;
  data: unknown;
  cachedAt: number;
}

interface OfflineDBSchema extends DBSchema {
  cache: {
    key: string;
    value: CacheEntry;
  };
}

const DB_NAME = 'payrollfiti-offline';
const DB_VERSION = 1;
const STORE_NAME = 'cache';

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<OfflineDBSchema>> {
  dbPromise ??= openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'key' });
    },
  });
  return dbPromise;
}

export async function readCacheEntry<T>(
  key: string,
): Promise<{ data: T; cachedAt: number } | undefined> {
  const db = await getDb();
  const entry = await db.get(STORE_NAME, key);
  if (!entry) return undefined;
  return { data: entry.data as T, cachedAt: entry.cachedAt };
}

export async function writeCacheEntry<T>(
  key: string,
  data: T,
): Promise<void> {
  const db = await getDb();
  await db.put(STORE_NAME, { key, data, cachedAt: Date.now() });
}
