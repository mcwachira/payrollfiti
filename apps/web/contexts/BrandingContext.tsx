'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  PropsWithChildren,
} from 'react';
import type { BrandingConfigDto } from '@repo/api';
import { apiFetch } from '@/lib/api-client';
import { APP_NAME } from '@/lib/config';
import { useAuth } from './AuthContext';

const DEFAULT_BRANDING: BrandingConfigDto = { appName: APP_NAME };

interface BrandingContextValue extends BrandingConfigDto {
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextValue>({
  ...DEFAULT_BRANDING,
  refreshBranding: async () => {},
});

export function BrandingProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [branding, setBranding] = useState<BrandingConfigDto>(DEFAULT_BRANDING);

  const fetchBranding = useCallback(async () => {
    const path = user ? '/branding' : '/branding/default';
    try {
      const result = await apiFetch<BrandingConfigDto>(
        path,
        user ? {} : ({ skipAuth: true } as RequestInit & { skipAuth: boolean }),
      );
      setBranding(result);
    } catch {
      setBranding(DEFAULT_BRANDING);
    }
  }, [user]);

  useEffect(() => {
    void fetchBranding();
  }, [fetchBranding]);

  return (
    <BrandingContext.Provider
      value={{ ...branding, refreshBranding: fetchBranding }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding(): BrandingContextValue {
  return useContext(BrandingContext);
}
