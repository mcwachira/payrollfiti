import type { BrandingConfigDto } from '@repo/api';
import { apiFetch } from './api-client';

export function getBranding(): Promise<BrandingConfigDto> {
  return apiFetch<BrandingConfigDto>('/branding');
}

export function updateBranding(
  input: Partial<BrandingConfigDto>,
): Promise<BrandingConfigDto> {
  return apiFetch<BrandingConfigDto>('/branding', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
