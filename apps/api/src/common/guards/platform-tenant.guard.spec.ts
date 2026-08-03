import { describe, it, expect } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformTenantGuard } from './platform-tenant.guard';

const PLATFORM_TENANT_ID = 'platform-tenant-1';

function makeContext(
  user: { tenantId: string } | undefined,
  extra: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, ...extra }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeConfigService(platformTenantId?: string) {
  return {
    get: (key: string) =>
      key === 'platformTenantId' ? platformTenantId : undefined,
  } as any;
}

describe('PlatformTenantGuard', () => {
  it('allows access when the route has no @PlatformOnly restriction', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new PlatformTenantGuard(
      reflector,
      makeConfigService(PLATFORM_TENANT_ID),
    );
    expect(
      guard.canActivate(makeContext({ tenantId: 'some-other-tenant' })),
    ).toBe(true);
  });

  it('allows access when the request belongs to the platform tenant', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new PlatformTenantGuard(
      reflector,
      makeConfigService(PLATFORM_TENANT_ID),
    );
    expect(
      guard.canActivate(makeContext({ tenantId: PLATFORM_TENANT_ID })),
    ).toBe(true);
  });

  it("denies a different tenant's admin, even though @Roles(ADMIN) alone would have passed them", () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new PlatformTenantGuard(
      reflector,
      makeConfigService(PLATFORM_TENANT_ID),
    );
    expect(() =>
      guard.canActivate(makeContext({ tenantId: 'some-customer-tenant' })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed when PLATFORM_TENANT_ID is not configured, rather than admitting everyone', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new PlatformTenantGuard(
      reflector,
      makeConfigService(undefined),
    );
    expect(() =>
      guard.canActivate(makeContext({ tenantId: 'any-tenant-at-all' })),
    ).toThrow(ForbiddenException);
  });

  it('denies access when there is no authenticated user at all', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new PlatformTenantGuard(
      reflector,
      makeConfigService(PLATFORM_TENANT_ID),
    );
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('fails closed for an API-key-authenticated request, even though its placeholder tenantId might match', () => {
    const reflector = { getAllAndOverride: () => true } as unknown as Reflector;
    const guard = new PlatformTenantGuard(
      reflector,
      makeConfigService(PLATFORM_TENANT_ID),
    );
    expect(() =>
      guard.canActivate(
        makeContext({ tenantId: PLATFORM_TENANT_ID }, { isApiKeyAuth: true }),
      ),
    ).toThrow(ForbiddenException);
  });
});
