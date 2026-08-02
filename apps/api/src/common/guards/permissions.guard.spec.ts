import { describe, it, expect } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PermissionsGuard } from './permissions.guard';
import { Permission } from '../permissions/permission.enum';
import { ROLE_PERMISSIONS } from '../permissions/role-permissions.map';

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

describe('PermissionsGuard', () => {
  it('allows access when the route has no @RequirePermission restriction', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.EMPLOYEE }))).toBe(true);
  });

  it('allows access when the user role grants all required permissions', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.BILLING_MANAGE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(guard.canActivate(makeContext({ role: Role.ADMIN }))).toBe(true);
  });

  it('denies access when the user role is missing a required permission', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.BILLING_MANAGE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext({ role: Role.HR }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies access when there is no authenticated user at all', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.EMPLOYEE_WRITE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('denies EMPLOYEE role for any permission-gated route', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.REPORTS_READ],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(makeContext({ role: Role.EMPLOYEE })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed for an API-key-authenticated request on a permission-restricted route, even though the placeholder role would otherwise satisfy it', () => {
    const reflector = {
      getAllAndOverride: () => [Permission.API_KEY_MANAGE],
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);
    expect(() =>
      guard.canActivate(
        makeContext({ role: Role.ADMIN }, { isApiKeyAuth: true }),
      ),
    ).toThrow(ForbiddenException);
  });

  describe('ROLE_PERMISSIONS invariants', () => {
    it('defines a permission list for every Role', () => {
      Object.values(Role).forEach((role) => {
        expect(ROLE_PERMISSIONS[role]).toBeDefined();
      });
    });

    it('grants ADMIN at least as many permissions as HR', () => {
      expect(ROLE_PERMISSIONS.ADMIN.length).toBeGreaterThanOrEqual(
        ROLE_PERMISSIONS.HR.length,
      );
    });

    it('grants EMPLOYEE no permissions', () => {
      expect(ROLE_PERMISSIONS.EMPLOYEE).toEqual([]);
    });

    it('keeps admin-only actions (tenant/company management, employee termination, branding, billing, API keys, webhooks) out of HR', () => {
      expect(ROLE_PERMISSIONS.HR).not.toContain(Permission.TENANT_MANAGE);
      expect(ROLE_PERMISSIONS.HR).not.toContain(
        Permission.EMPLOYEE_TERMINATE,
      );
      expect(ROLE_PERMISSIONS.HR).not.toContain(Permission.BRANDING_MANAGE);
      expect(ROLE_PERMISSIONS.HR).not.toContain(Permission.BILLING_MANAGE);
      expect(ROLE_PERMISSIONS.HR).not.toContain(Permission.API_KEY_MANAGE);
      expect(ROLE_PERMISSIONS.HR).not.toContain(Permission.WEBHOOK_MANAGE);
    });

    it('grants HR the day-to-day HR/payroll operations', () => {
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.EMPLOYEE_WRITE);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.PAYROLL_RUN);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.PAYROLL_CORRECT);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.PAYROLL_READ);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.LEAVE_APPROVE);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.LEAVE_TYPE_MANAGE);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.DOCUMENT_DELETE);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.REPORTS_READ);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.ATTENDANCE_MANAGE);
      expect(ROLE_PERMISSIONS.HR).toContain(Permission.LOAN_MANAGE);
      expect(ROLE_PERMISSIONS.HR).toContain(
        Permission.SALARY_COMPONENT_MANAGE,
      );
    });

    it('grants ADMIN every declared permission', () => {
      expect(ROLE_PERMISSIONS.ADMIN).toEqual(Object.values(Permission));
    });
  });
});
