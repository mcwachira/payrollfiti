import { describe, it, expect } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';

function makeContext(
  user: { role: Role } | undefined,
  extra: Record<string, unknown> = {},
): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user, ...extra }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when the route has no @Roles restriction', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.EMPLOYEE }))).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN, Role.HR],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.HR }))).toBe(true);
  });

  it('denies access when the user role is not in the required list', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() =>
      guard.canActivate(makeContext({ role: Role.EMPLOYEE })),
    ).toThrow(ForbiddenException);
  });

  it('denies access when there is no authenticated user at all', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('fails closed for an API-key-authenticated request on a role-restricted route, even though the placeholder role would otherwise satisfy it', () => {
    const reflector = {
      getAllAndOverride: () => [Role.ADMIN],
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() =>
      guard.canActivate(
        makeContext({ role: Role.ADMIN }, { isApiKeyAuth: true }),
      ),
    ).toThrow(ForbiddenException);
  });
});
