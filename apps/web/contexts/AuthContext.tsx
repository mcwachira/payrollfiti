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
import { apiFetch, ApiError } from '@/lib/api-client';
import { TokenStorage } from '@/lib/token-storage';
import { AuthenticatedUserDto, AuthTokensDto } from "@/shared-types"

interface SignupInput {
  tenantName: string;
  countryCode: string;
  adminEmail: string;
  adminPassword: string;
}

/** login() returns this instead of the user when the account has 2FA
 *  enabled — no tokens are issued yet, see verifyTwoFactor(). */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
}

interface AuthContextValue {
  user: AuthenticatedUserDto | null;
  isLoading: boolean;
  // Returns the authenticated user (not void) specifically so the caller
  // can redirect by role right away — reading `user` from this hook
  // immediately after awaiting login() would still see the PREVIOUS render's
  // value, since the setUser() call here doesn't re-render the caller's
  // closure synchronously. Returns a TwoFactorChallenge instead when the
  // account has 2FA enabled — see verifyTwoFactor().

  login:(
    email:string,
    password:string,
  ) => Promise<AuthenticatedUserDto | TwoFactorChallenge>;
  signup: (input: SignupInput) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  // Same shape/rationale as login() — resetPassword logs the user in
  // immediately, so the caller needs the fresh user back to redirect by role.
  resetPassword: (
    token: string,
    password: string,
  ) => Promise<AuthenticatedUserDto>;
  /** Completes the login flow login() started when it returned a TwoFactorChallenge. */
  verifyTwoFactor: (
    challengeToken: string,
    code: string,
  ) => Promise<AuthenticatedUserDto>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren<AuthContextValue>) {

  const [user, setUser] = useState<AuthenticatedUserDto |  null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if(!TokenStorage.getAccessToken()){
      setIsLoading(false);
      return;
    }
    apiFetch<AuthenticatedUserDto>('/auth/me').then(setUser).catch(() => TokenStorage.clear()).finally(() => setIsLoading(false));
  },[]);


  // Query keys like ['tenant', 'me'] or ['companies'] aren't scoped by
  // tenant/user id — without clearing here, switching accounts in the same
  // tab could keep showing the PREVIOUS session's cached tenant, company,
  // and employee data until each query happened to refetch.
  const applySession = useCallback(
    (data: { user: AuthenticatedUserDto } & AuthTokensDto) => {
      queryClient.clear();
      TokenStorage.setToken(data.accessToken, data.refreshToken);
      setUser(data.user);
      return data.user;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<
        ({ user: AuthenticatedUserDto } & AuthTokensDto) | TwoFactorChallenge
      >('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      } as RequestInit & { skipAuth: boolean });
      if ('twoFactorRequired' in data) return data;
      return applySession(data);
    },
    [applySession],
  );

  const verifyTwoFactor = useCallback(
    async (challengeToken: string, code: string) => {
      const data = await apiFetch<
        { user: AuthenticatedUserDto } & AuthTokensDto
      >('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ challengeToken, code }),
        skipAuth: true,
      } as RequestInit & { skipAuth: boolean });
      return applySession(data);
    },
    [applySession],
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
      applySession(data);
    },
    [applySession],
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
      applySession(data);
    },
    [applySession],
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
      return applySession(data);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
    } finally {
      queryClient.clear();
      TokenStorage.clear();
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
        verifyTwoFactor,
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
