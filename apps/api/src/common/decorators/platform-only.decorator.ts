import { SetMetadata } from '@nestjs/common';

export const PLATFORM_ONLY_KEY = 'platformOnly';

/**
 * Restricts a route to the platform-owner's own tenant (PLATFORM_TENANT_ID),
 * regardless of role — distinct from @Roles(), which only checks role
 * *within whichever tenant the request already belongs to*. A customer
 * tenant's ADMIN passes @Roles(ADMIN) the same as the platform owner's
 * ADMIN does; this decorator is what tells them apart. See PlatformTenantGuard.
 */
export const PlatformOnly = () => SetMetadata(PLATFORM_ONLY_KEY, true);
