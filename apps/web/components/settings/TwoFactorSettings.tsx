'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
} from '@/lib/two-factor-api';
import { ApiError } from '@/lib/api-client';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

type EnableStep = 'closed' | 'scan' | 'backup-codes';

function EnableTwoFactorFlow({ onEnabled }: { onEnabled: () => void }) {
  const [step, setStep] = useState<EnableStep>('closed');
  const [code, setCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const setupQuery = useQuery({
    queryKey: ['2fa-setup'],
    queryFn: setupTwoFactor,
    enabled: step === 'scan',
  });

  const enableMutation = useMutation({
    mutationFn: enableTwoFactor,
    onSuccess: (result) => {
      setBackupCodes(result.backupCodes);
      setStep('backup-codes');
    },
    onError: (error) => {
      toast.error('Could not verify that code', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  const close = () => {
    setStep('closed');
    setCode('');
    setBackupCodes([]);
  };

  const finish = () => {
    close();
    onEnabled();
  };

  return (
    <>
      <Button size="sm" onClick={() => setStep('scan')}>
        Enable two-factor authentication
      </Button>

      <Dialog open={step === 'scan'} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Scan this QR code</DialogTitle>
            <DialogDescription>
              Scan it with Google Authenticator, Authy, or any TOTP app, then
              enter the 6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          {setupQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Generating…</p>
          ) : setupQuery.error ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errorMessage(setupQuery.error, 'Failed to start setup')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                {setupQuery.data && (
                  <Image
                    src={setupQuery.data.qrCodeDataUrl}
                    alt="Two-factor authentication QR code"
                    width={200}
                    height={200}
                    unoptimized
                  />
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Can&apos;t scan it? Enter this key manually:
                </Label>
                <code className="block text-xs bg-muted rounded px-2 py-1.5 break-all">
                  {setupQuery.data?.secret}
                </code>
              </div>
              <div className="space-y-2">
                <Label htmlFor="enable-code">6-digit code</Label>
                <Input
                  id="enable-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              disabled={!code.trim() || enableMutation.isPending}
              onClick={() => enableMutation.mutate(code.trim())}
            >
              {enableMutation.isPending ? 'Verifying…' : 'Verify & enable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={step === 'backup-codes'}
        onOpenChange={(open) => !open && finish()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your backup codes</DialogTitle>
            <DialogDescription>
              Each code works once, if you lose access to your authenticator
              app. Store them somewhere safe — this is the only time
              they&apos;re shown.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 font-mono text-sm bg-muted rounded p-3">
            {backupCodes.map((backupCode) => (
              <span key={backupCode}>{backupCode}</span>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={finish}>I&apos;ve saved these</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DisableTwoFactorFlow({ onDisabled }: { onDisabled: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const disableMutation = useMutation({
    mutationFn: () => disableTwoFactor(password, code),
    onSuccess: () => {
      toast.success('Two-factor authentication disabled');
      setOpen(false);
      setPassword('');
      setCode('');
      onDisabled();
    },
    onError: (error) => {
      toast.error('Could not disable two-factor authentication', {
        description: errorMessage(error, 'Please check your password and code'),
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Disable
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable two-factor authentication</DialogTitle>
          <DialogDescription>
            Confirm your password and a current code to turn this off.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disable-password">Password</Label>
            <Input
              id="disable-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="disable-code">Code (or a backup code)</Label>
            <Input
              id="disable-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!password || !code || disableMutation.isPending}
            onClick={() => disableMutation.mutate()}
          >
            {disableMutation.isPending ? 'Disabling…' : 'Disable'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TwoFactorSettings() {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['2fa-status'],
    queryFn: getTwoFactorStatus,
  });

  const refreshStatus = () => {
    queryClient.invalidateQueries({ queryKey: ['2fa-status'] });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Two-Factor Authentication
        </CardTitle>
        <CardDescription>
          Require a code from an authenticator app, in addition to your
          password, when signing in
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : statusQuery.data?.enabled ? (
          <div className="flex items-center justify-between">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Enabled
            </Badge>
            <DisableTwoFactorFlow onDisabled={refreshStatus} />
          </div>
        ) : (
          <EnableTwoFactorFlow onEnabled={refreshStatus} />
        )}
      </CardContent>
    </Card>
  );
}
