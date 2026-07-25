import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../permissions/require-permission.decorator';
import { Permission } from '../permissions/permission.enum';
import { ROLE_PERMISSIONS } from '../permissions/role-permissions.map';
import { AuthenticatedRequestUser } from '../../auth/types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    // Mirror RolesGuard: an API-key-authenticated request's placeholder
    // role must never be allowed to satisfy a permission check.
    if (request.isApiKeyAuth) {
      throw new ForbiddenException(
        'API-key authentication is not permitted on permission-restricted routes',
      );
    }
    const user: AuthenticatedRequestUser | undefined = request.user;
    const granted = user ? ROLE_PERMISSIONS[user.role] : [];
    const hasAll = requiredPermissions.every((permission) =>
      granted.includes(permission),
    );
    if (!hasAll) {
      throw new ForbiddenException(
        `Requires permission(s): ${requiredPermissions.join(', ')}`,
      );
    }
    return true;
  }
}
