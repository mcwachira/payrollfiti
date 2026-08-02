import { apiFetch } from './api-client';
import type { Company } from './employees-api';

export interface Tenant {
  id: string;
  name: string;
  countryCode: string;
  defaultCurrency: string;
}

export interface CreateCompanyInput {
  name: string;
  currency?: string;
}

export function getMyTenant(): Promise<Tenant> {
  return apiFetch<Tenant>('/tenants/me');
}

/**
 * There is no frontend caller of `POST /tenants/companies` anywhere in the
 * app today — a new tenant has no Company after signup, and nothing in the
 * UI lets an admin create one. This is the missing link the onboarding
 * wizard (app/(app)/onboarding/page.tsx) closes. `listCompanies()` (the
 * read side of this same resource) already lives in employees-api.ts —
 * kept there rather than duplicated here.
 */
export function createCompany(input: CreateCompanyInput): Promise<Company> {
  return apiFetch<Company>('/tenants/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
