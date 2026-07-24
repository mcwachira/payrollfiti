// Types shared between apps/api and apps/web so the frontend never has to
// duplicate backend enums by hand. Mirrors the Prisma enums in
// apps/api/prisma/schema.prisma.

export enum Role {
  ADMIN = 'ADMIN',
  HR = 'HR',
  EMPLOYEE = 'EMPLOYEE',
}

export enum EmploymentType {
  PERMANENT = 'PERMANENT',
  CONTRACT = 'CONTRACT',
  CASUAL = 'CASUAL',
  INTERN = 'INTERN',
}

export enum PayrollRunStatus {
  DRAFT = 'DRAFT',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export interface BrandingConfigDto {
  appName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUserDto {
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  employeeId?: string | null;
}
