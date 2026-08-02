'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthTokensDto, AuthenticatedUserDto } from '@repo/api';
import { apiFetch, ApiError } from '@/lib/api-client';
import { tokenStorage } from '@/lib/token-storage';

interface SignupInput {
  tenantName: string;
  countryCode: string;
  adminEmail: string;
  adminPassword: string;
}

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  isLoading: boolean;
  // login() returns the authenticated user (not void) specifically so the
  // caller can redirect by role right away — reading `user` from this hook
  // immediately after awaiting login() would still see the PREVIOUS render's
  // value, since the setUser() call here doesn't re-render the caller's
  // closure synchronously.
  login: (email: string, password: string) => Promise<AuthenticatedUserDto>;
  signup: (input: SignupInput) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  // Same shape/rationale as login() — resetPassword logs the user in
  // immediately, so the caller needs the fresh user back to redirect by role.
  resetPassword: (
    token: string,
    password: string,
  ) => Promise<AuthenticatedUserDto>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthenticatedUserDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tokenStorage.getAccessToken()) {
      setIsLoading(false);
      return;
    }
    apiFetch<AuthenticatedUserDto>('/auth/me')
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<
        { user: AuthenticatedUserDto } & AuthTokensDto
      >('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      } as RequestInit & { skipAuth: boolean });
      // Query keys like ['tenant', 'me'] or ['companies'] aren't scoped by
      // tenant/user id — without clearing here, switching accounts in the
      // same tab could keep showing the PREVIOUS session's cached tenant,
      // company, and employee data until each query happened to refetch.
      queryClient.clear();
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    },
    [queryClient],
  );

  const signup = useCallback(
    async (input: SignupInput) => {
      const data = await apiFetch<
        { user: AuthenticatedUserDto } & AuthTokensDto
      >('/auth/signup', {
        method: 'POST',
        body: JSON.stringify(input),
        skipAuth: true,
      } as RequestInit & { skipAuth: boolean });
      queryClient.clear();
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    },
    [queryClient],
  );

  const acceptInvite = useCallback(
    async (token: string, password: string) => {
      const data = await apiFetch<
        { user: AuthenticatedUserDto } & AuthTokensDto
      >('/auth/accept-invite', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
        skipAuth: true,
      } as RequestInit & { skipAuth: boolean });
      queryClient.clear();
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
    },
    [queryClient],
  );

  const forgotPassword = useCallback(async (email: string) => {
    await apiFetch<void>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
      skipAuth: true,
    } as RequestInit & { skipAuth: boolean });
  }, []);

  const resetPassword = useCallback(
    async (token: string, password: string) => {
      const data = await apiFetch<
        { user: AuthenticatedUserDto } & AuthTokensDto
      >('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
        skipAuth: true,
      } as RequestInit & { skipAuth: boolean });
      queryClient.clear();
      tokenStorage.setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      queryClient.clear();
      tokenStorage.clear();
      setUser(null);
      router.push('/login');
    }
  }, [router, queryClient]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        acceptInvite,
        forgotPassword,
        resetPassword,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
