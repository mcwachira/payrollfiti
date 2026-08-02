import { Role } from '@prisma/client';
import { Permission } from './permission.enum';

// Permissions ADMIN alone holds — mirrors the pre-existing @Roles(Role.ADMIN)
// (as opposed to @Roles(Role.ADMIN, Role.HR)) split on each controller.
const ADMIN_ONLY_PERMISSIONS: Permission[] = [
  Permission.BILLING_MANAGE,
  Permission.API_KEY_MANAGE,
  Permission.WEBHOOK_MANAGE,
  Permission.TENANT_MANAGE,
  Permission.EMPLOYEE_TERMINATE,
  Permission.BRANDING_MANAGE,
  Permission.AUDIT_LOG_READ,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.HR]: Object.values(Permission).filter(
    (permission) => !ADMIN_ONLY_PERMISSIONS.includes(permission),
  ),
  [Role.EMPLOYEE]: [],
};
