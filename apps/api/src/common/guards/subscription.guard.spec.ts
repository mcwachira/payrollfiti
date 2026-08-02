import { describe, it, expect, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@prisma/client';
import { SubscriptionGuard } from './subscription.guard';

// See billing.service.spec.ts for why this typed helper is needed instead
// of a bare jest.fn(): an untyped mock's return type collapses to `never`
// under .mockResolvedValue(), not `Promise<unknown>`.
const asyncMock = (value?: unknown) =>
  jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(value);

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

function makeReflector(overrides: {
  isPublic?: boolean;
  isExempt?: boolean;
}): Reflector {
  return {
    getAllAndOverride: jest
      .fn()
      .mockReturnValueOnce(overrides.isPublic)
      .mockReturnValueOnce(overrides.isExempt),
  } as unknown as Reflector;
}

describe('SubscriptionGuard', () => {
  it('allows a @Public() route without checking anything', async () => {
    const prisma = { subscription: { findUnique: asyncMock() } } as any;
    const guard = new SubscriptionGuard(
      makeReflector({ isPublic: true }),
      prisma,
    );
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).resolves.toBe(true);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('allows an @AllowWithoutSubscription() route regardless of subscription state', async () => {
    const prisma = { subscription: { findUnique: asyncMock() } } as any;
    const guard = new SubscriptionGuard(
      makeReflector({ isExempt: true }),
      prisma,
    );
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).resolves.toBe(true);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('allows an API-key-authenticated request without a subscription check', async () => {
    const prisma = { subscription: { findUnique: asyncMock() } } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(
        makeContext({ tenantId: 't1' }, { isApiKeyAuth: true }),
      ),
    ).resolves.toBe(true);
    expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
  });

  it('fails open when the tenant has no Subscription row at all', async () => {
    const prisma = {
      subscription: { findUnique: asyncMock(null) },
    } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).resolves.toBe(true);
  });

  it('allows an active, unexpired trial', async () => {
    const prisma = {
      subscription: {
        findUnique: asyncMock({
          status: SubscriptionStatus.TRIALING,
          currentPeriodEnd: new Date(Date.now() + 60_000),
        }),
      },
    } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).resolves.toBe(true);
  });

  it('denies an expired trial', async () => {
    const prisma = {
      subscription: {
        findUnique: asyncMock({
          status: SubscriptionStatus.TRIALING,
          currentPeriodEnd: new Date(Date.now() - 60_000),
        }),
      },
    } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a PAST_DUE subscription', async () => {
    const prisma = {
      subscription: {
        findUnique: asyncMock({
          status: SubscriptionStatus.PAST_DUE,
          currentPeriodEnd: new Date(Date.now() + 60_000),
        }),
      },
    } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('denies a CANCELED subscription', async () => {
    const prisma = {
      subscription: {
        findUnique: asyncMock({
          status: SubscriptionStatus.CANCELED,
          currentPeriodEnd: new Date(Date.now() + 60_000),
        }),
      },
    } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an ACTIVE subscription', async () => {
    const prisma = {
      subscription: {
        findUnique: asyncMock({
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd: new Date(Date.now() + 60_000),
        }),
      },
    } as any;
    const guard = new SubscriptionGuard(makeReflector({}), prisma);
    await expect(
      guard.canActivate(makeContext({ tenantId: 't1' })),
    ).resolves.toBe(true);
  });
});
