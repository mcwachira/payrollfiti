import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PLATFORM_ONLY_KEY } from '../decorators/platform-only.decorator';
import { AuthenticatedRequestUser } from '../../auth/types';
import { AppConfig } from '../../config/configuration';

/**
 * Enforces @PlatformOnly() — a route restricted to PLATFORM_TENANT_ID's own
 * tenant, not just any tenant's ADMIN. Mirrors RolesGuard/PermissionsGuard's
 * shape (global guard, no-ops when the route has no matching decorator).
 */
@Injectable()
export class PlatformTenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPlatformOnly = this.reflector.getAllAndOverride<boolean>(
      PLATFORM_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!isPlatformOnly) return true;

    const request = context.switchToHttp().getRequest();
    if (request.isApiKeyAuth) {
      throw new ForbiddenException(
        'API-key authentication is not permitted on platform-restricted routes',
      );
    }

    const platformTenantId = this.configService.get('platformTenantId', {
      infer: true,
    });
    const user: AuthenticatedRequestUser | undefined = request.user;

    // Fail closed: an unset PLATFORM_TENANT_ID means nobody passes, not
    // "everyone passes" — the opposite mistake would silently reopen this
    // route to every customer tenant's admin.
    if (!platformTenantId || !user || user.tenantId !== platformTenantId) {
      throw new ForbiddenException(
        'This action is restricted to the platform team',
      );
    }
    return true;
  }
}
