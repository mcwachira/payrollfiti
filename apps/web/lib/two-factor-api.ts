import { apiFetch } from './api-client';

// verifyTwoFactor itself lives on useAuth() (AuthContext), not here — it
// needs to set tokens/user in context state on success, same as login().

export function getTwoFactorStatus(): Promise<{ enabled: boolean }> {
  return apiFetch<{ enabled: boolean }>('/auth/2fa/status');
}

export function setupTwoFactor(): Promise<{
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}> {
  return apiFetch('/auth/2fa/setup', { method: 'POST' });
}

export function enableTwoFactor(
  code: string,
): Promise<{ backupCodes: string[] }> {
  return apiFetch<{ backupCodes: string[] }>('/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function disableTwoFactor(
  password: string,
  code: string,
): Promise<void> {
  return apiFetch<void>('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password, code }),
  });
}
