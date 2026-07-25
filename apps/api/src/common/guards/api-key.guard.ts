import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ApiKeysService } from '../../api-keys/api-keys.service';

/**
 * Guards the read-only `public-api/v1` routes with an `X-API-Key` header
 * instead of a JWT. Those routes are also marked `@Public()` so the global
 * `JwtAuthGuard` skips them; this guard is applied explicitly via
 * `@UseGuards(ApiKeyGuard)` on the public-api controller.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'];
    if (!key || typeof key !== 'string') {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const tenantContext = await this.apiKeysService.validate(key);
    if (!tenantContext) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    // Shaped exactly like AuthenticatedRequestUser so the existing
    // @CurrentTenant()/@CurrentUser() decorators work unmodified on
    // public-api routes. `role` here is a placeholder only — it must never
    // be relied on to grant access. `isApiKeyAuth` lets RolesGuard/
    // PermissionsGuard fail closed if a role/permission check is ever added
    // to a public-api route, instead of this placeholder silently
    // satisfying it (see roles.guard.ts / permissions.guard.ts).
    request.user = {
      id: 'api-key',
      email: '',
      role: Role.ADMIN,
      tenantId: tenantContext.tenantId,
      employeeId: null,
    };
    request.isApiKeyAuth = true;

    return true;
  }
}
