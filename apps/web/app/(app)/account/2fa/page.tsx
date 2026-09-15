'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/api-client';
import { toast } from 'sonner';

export default function TwoFactorPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const setupQuery = useQuery({
    queryKey: ['2fa-setup'],
    queryFn: async () => {
      const data = await apiFetch<{ qrCode?: string }>('/account/2fa/setup', {
        method: 'POST',
      });
      return data;
    },
    enabled: false,
  });

  const verifyMutation = useMutation({
    mutationFn: async (code: string) => {
      const data = await apiFetch<{ message?: string }>('/account/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      return data;
    },
    onSuccess: () => {
      toast.success('2FA enabled');
      setVerifyCode('');
      queryClient.invalidateQueries({ queryKey: ['2fa-setup'] });
    },
    onError: () => {
      toast.error('Invalid code');
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      const data = await apiFetch<{ message?: string }>('/account/2fa/disable', {
        method: 'POST',
      });
      return data;
    },
    onSuccess: () => {
      toast.success('2FA disabled');
      queryClient.invalidateQueries({ queryKey: ['2fa-setup'] });
    },
    onError: (error) => {
      toast.error('Could not disable 2FA', {
        description: error instanceof Error ? error.message : undefined,
      });
    },
  });

  const recoveryMutation = useMutation({
    mutationFn: async () => {
      const data = await apiFetch<{ recoveryCodes?: string[] }>('/account/2fa/recovery-codes', {
        method: 'POST',
      });
      return data;
    },
    onSuccess: (data) => {
      setRecoveryCodes(data.recoveryCodes ?? []);
      toast.success('Recovery codes generated');
    },
    onError: () => {
      toast.error('Could not generate recovery codes');
    },
  });

  const handleSetup = () => {
    setupQuery.refetch();
  };

  if (setupQuery.isFetching) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-black" />
      </div>
    );
  }

  if (setupQuery.data) {
    const data = setupQuery.data;
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Two-Factor Authentication
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Set up 2FA for your account.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Scan QR Code
            </CardTitle>
            <CardDescription>
              Scan this QR code with your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.qrCode && (
              <img
                src={data.qrCode}
                alt="2FA QR Code"
                className="mx-auto"
              />
            )}
            <div className="space-y-2">
              <Label htmlFor="verifyCode">Enter 6-digit code</Label>
              <Input
                id="verifyCode"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value)}
                maxLength={6}
              />
            </div>
            <Button
              onClick={() => verifyMutation.mutate(verifyCode)}
              disabled={verifyMutation.isPending}
            >
              {verifyMutation.isPending && 'Verifying…'}
              Verify & Enable
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">
          Two-Factor Authentication
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Add an extra layer of security to your account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            2FA Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.twoFactorEnabled ? (
            <>
              <p className="text-sm text-green-600">
                Two-factor authentication is enabled.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => disableMutation.mutate()}
                  disabled={disableMutation.isPending}
                >
                  {disableMutation.isPending && 'Disabling…'}
                  Disable 2FA
                </Button>
                <Button
                  variant="neutral"
                  onClick={() => recoveryMutation.mutate()}
                  disabled={recoveryMutation.isPending}
                >
                  {recoveryMutation.isPending && 'Generating…'}
                  Regenerate Recovery Codes
                </Button>
              </div>
              {recoveryCodes.length > 0 && (
                <div className="space-y-2">
                  <Label>Recovery Codes</Label>
                  <code className="block rounded bg-muted p-2 text-xs break-all">
                    {recoveryCodes.join('\n')}
                  </code>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Two-factor authentication is not enabled.
              </p>
              <Button onClick={handleSetup}>
                Enable 2FA
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
