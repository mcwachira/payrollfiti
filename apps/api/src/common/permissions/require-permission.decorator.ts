import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.enum';

export const PERMISSIONS_KEY = 'permissions';

/** Restricts a route to the given fine-grained permissions (in addition to any @Roles() gate) */
export const RequirePermission = (...perms: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, perms);
