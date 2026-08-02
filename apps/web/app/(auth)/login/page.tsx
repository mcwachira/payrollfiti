'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Role } from '@repo/api';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { ApiError } from '@/lib/api-client';

export default function LoginPage() {
  const { login, verifyTwoFactor } = useAuth();
  const branding = useBranding();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectByRole = (role: Role) => {
    // /dashboard calls GET /employees and GET /payroll-runs, both
    // ADMIN/HR-only server-side — an EMPLOYEE landing there gets two 403s
    // instead of their portal.
    router.push(role === Role.EMPLOYEE ? '/employee-portal' : '/dashboard');
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if ('twoFactorRequired' in result) {
        setChallengeToken(result.challengeToken);
      } else {
        redirectByRole(result.role);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to log in');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const user = await verifyTwoFactor(challengeToken, code);
      redirectByRole(user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (challengeToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{branding.appName}</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app, or one of your
              backup codes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              {error ? (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-400"
                >
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Verifying…' : 'Verify'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setChallengeToken(null);
                  setCode('');
                  setError(null);
                }}
              >
                Back to sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{branding.appName}</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-muted-foreground underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error ? (
              <p
                role="alert"
                className="text-sm text-red-600 dark:text-red-400"
              >
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            New to {branding.appName}?{' '}
            <Link href="/signup" className="underline">
              Create a workspace
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
