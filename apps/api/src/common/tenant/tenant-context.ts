import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextStore {
  tenantId: string;
}

const storage = new AsyncLocalStorage<TenantContextStore>();

/**
 * Carries the authenticated request's tenantId through the async call chain
 * (set by TenantContextInterceptor) so PrismaService's tenant-scoping
 * extension can read it without every service having to pass tenantId
 * through explicitly. Unset outside a request (cron jobs, queue processors,
 * seed scripts, signup) — those paths run without enforcement by design.
 */
export const TenantContext = {
  run<T>(store: TenantContextStore, fn: () => T): T {
    return storage.run(store, fn);
  },
  getTenantId(): string | undefined {
    return storage.getStore()?.tenantId;
  },
};
