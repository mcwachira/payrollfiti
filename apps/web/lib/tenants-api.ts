import { apiFetch } from './api-client';

export interface Tenant {
  id: string;
  name: string;
  countryCode: string;
  defaultCurrency: string;
}

export function getMyTenant(): Promise<Tenant> {
  return apiFetch<Tenant>('/tenants/me');
}
