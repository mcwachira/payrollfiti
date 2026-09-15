import type { AuthTokensDto } from '@repo/api';
import { API_URL } from './config';
import { tokenStorage } from './token-storage';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let refreshPromise: Promise<AuthTokensDto> | null = null;

async function refreshTokens(): Promise<AuthTokensDto> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) throw new ApiError(401, 'No refresh token');

  const response = await fetch(`${API_URL}/refresh`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${refreshToken}` },
    credentials: 'include',
  });
  if (!response.ok) {
    tokenStorage.clear();
    throw new ApiError(response.status, 'Session expired');
  }
  const data = (await response.json()) as AuthTokensDto;
  tokenStorage.setTokens(data.accessToken, data.refreshToken);
  return data;
}

async function ensureCsrfCookie(): Promise<void> {
  try {
    await fetch(`${API_URL}/sanctum/csrf-cookie`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    // best-effort; the next request may still fail with a clearer error
  }
}

interface ApiFetchOptions extends RequestInit {
  skipAuth?: boolean;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}, isRetry = false): Promise<T> {
  const { skipAuth, headers, ...rest } = options;
  const accessToken = tokenStorage.getAccessToken();

  const isMutation = rest.method && !['GET', 'HEAD', 'OPTIONS'].includes(rest.method.toUpperCase());

  if (isMutation && !isRetry) {
    await ensureCsrfCookie();
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(rest.body && !(rest.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  if (response.status === 419 && !isRetry) {
    await ensureCsrfCookie();
    return apiFetch<T>(path, options, true);
  }

  if (response.status === 401 && !skipAuth && !isRetry) {
    try {
      refreshPromise ??= refreshTokens().finally(() => {
        refreshPromise = null;
      });
      await refreshPromise;
      return apiFetch<T>(path, options, true);
    } catch {
      tokenStorage.clear();
      throw new ApiError(401, 'Session expired, please log in again');
    }
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? 'Request failed');
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/** For binary responses (PDF payslips, CSV bank exports) — fetches then triggers a browser download. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const accessToken = tokenStorage.getAccessToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Failed to download ${filename}`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
