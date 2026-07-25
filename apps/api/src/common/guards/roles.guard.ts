import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AuthenticatedRequestUser } from '../../auth/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    // API-key-authenticated requests carry a placeholder role (see
    // ApiKeyGuard) that must never be allowed to satisfy a real role
    // check — fail closed rather than let it silently pass.
    if (request.isApiKeyAuth) {
      throw new ForbiddenException(
        'API-key authentication is not permitted on role-restricted routes',
      );
    }
    const user: AuthenticatedRequestUser | undefined = request.user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Requires one of roles: ${requiredRoles.join(', ')}`,
      );
    }
    return true;
  }
}
