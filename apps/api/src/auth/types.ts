import { Role } from '@prisma/client';

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  employeeId: string | null;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
  tenantId: string;
  employeeId: string | null;
}

export interface JwtRefreshPayload {
  sub: string;
}
