import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant/tenant-context';

/**
 * Models that carry a direct `tenantId` scalar column (see schema.prisma).
 * Models reached only through a relation — Employee -> Company -> Tenant,
 * PayrollRun -> Company -> Tenant, etc. — aren't listed here: Prisma can't
 * generically inject a nested join filter for those, so they still rely on
 * the explicit `company.tenantId` ownership checks already in each service.
 */
export const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'BrandingConfig',
  'Company',
  'User',
  'SalaryComponent',
  'LeaveType',
  'AuditLog',
  'Subscription',
  'Invoice',
  'UsageRecord',
  'Notification',
  'ApiKey',
  'WebhookEndpoint',
  'Loan',
]);

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

const WHERE_SCOPED_WRITE_OPS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
]);

function assertNotCrossTenant(data: unknown, tenantId: string) {
  if (
    data &&
    typeof data === 'object' &&
    'tenantId' in data &&
    (data as { tenantId?: unknown }).tenantId !== undefined &&
    (data as { tenantId?: unknown }).tenantId !== tenantId
  ) {
    throw new ForbiddenException(
      'Cross-tenant write blocked: tenantId does not match the authenticated tenant',
    );
  }
}

/**
 * Pure argument transform: given a Prisma operation on a tenant-scoped
 * model plus the caller's tenantId, returns the args rewritten to enforce
 * isolation. Kept separate from the $extends wiring below so it can be unit
 * tested without a live database — same rationale as the payroll engine
 * being a pure (input, ruleset) -> result function.
 */
export function scopeQueryArgs(
  operation: string,
  args: Record<string, unknown>,
  tenantId: string,
): Record<string, unknown> {
  const scoped = { ...args } as {
    where?: Record<string, unknown>;
    data?: unknown;
    create?: unknown;
    update?: unknown;
  };

  if (READ_OPS.has(operation) || WHERE_SCOPED_WRITE_OPS.has(operation)) {
    scoped.where = { ...(scoped.where ?? {}), tenantId };
  }

  if (operation === 'create') {
    assertNotCrossTenant(scoped.data, tenantId);
    scoped.data = { ...(scoped.data as object), tenantId };
  }

  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    const rows = Array.isArray(scoped.data) ? scoped.data : [scoped.data];
    rows.forEach((row) => assertNotCrossTenant(row, tenantId));
    scoped.data = rows.map((row) => ({ ...(row as object), tenantId }));
  }

  if (
    operation === 'update' ||
    operation === 'updateMany' ||
    operation === 'updateManyAndReturn'
  ) {
    assertNotCrossTenant(scoped.data, tenantId);
  }

  if (operation === 'upsert') {
    scoped.where = { ...(scoped.where ?? {}), tenantId };
    assertNotCrossTenant(scoped.create, tenantId);
    scoped.create = { ...(scoped.create as object), tenantId };
    assertNotCrossTenant(scoped.update, tenantId);
  }

  return scoped as Record<string, unknown>;
}

/**
 * Structural tenant isolation for TENANT_SCOPED_MODELS. Inside an
 * authenticated request (TenantContext set by TenantContextInterceptor),
 * every read/write on these models is scoped to the caller's tenant
 * regardless of whether the calling service remembered to filter by
 * tenantId itself; a mismatched or spoofed tenantId in write payloads is
 * rejected outright. Outside a request (cron jobs, queue processors, seed
 * scripts, signup creating the very first Tenant/Company/User) TenantContext
 * is unset and this is a no-op, since those paths legitimately need to
 * operate without, or before, a tenant context.
 */
export const tenantScopingExtension = Prisma.defineExtension({
  name: 'tenant-scoping',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!model || !TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }
        const tenantId = TenantContext.getTenantId();
        if (!tenantId) {
          return query(args);
        }
        return query(
          scopeQueryArgs(operation, args as Record<string, unknown>, tenantId) as typeof args,
        );
      },
    },
  },
});
