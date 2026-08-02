'use client';

import { PropsWithChildren, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@repo/api';
import { useAuth } from '@/contexts/AuthContext';

interface RoleRedirectGuardProps {
  allow: Role[];
}

/**
 * Unlike RoleGuard (which renders an inline "you don't have permission"
 * card — appropriate for a page a user might legitimately try to reach),
 * this redirects away entirely. Used on pages an EMPLOYEE should never see
 * at all — Dashboard, Employees, Payroll, Leave Management, Analytics,
 * Compliance — so navigating there directly by URL (not just clicking a
 * hidden sidebar link) still lands them somewhere real rather than an
 * error state built around data their role can't fetch.
 */
export function RoleRedirectGuard({
  allow,
  children,
}: PropsWithChildren<RoleRedirectGuardProps>) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user && !allow.includes(user.role)) {
      router.replace('/employee-portal');
    }
  }, [isLoading, user, allow, router]);

  if (isLoading || !user || !allow.includes(user.role)) {
    return null;
  }
  return <>{children}</>;
}
