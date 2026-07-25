import { Role } from '@prisma/client';
import { Permission } from './permission.enum';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.HR]: Object.values(Permission).filter(
    (permission) =>
      permission !== Permission.BILLING_MANAGE &&
      permission !== Permission.API_KEY_MANAGE &&
      permission !== Permission.WEBHOOK_MANAGE,
  ),
  [Role.EMPLOYEE]: [],
};
