import { Role } from '@prisma/client';

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  employeeId: string | null;
  /** Which Session row this access token belongs to — lets /auth/sessions mark "this device". */
  sessionId: string;
}

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: Role;
  tenantId: string;
  employeeId: string | null;
  sessionId: string;
}

export interface JwtRefreshPayload {
  sub: string;
  sessionId: string;
}
