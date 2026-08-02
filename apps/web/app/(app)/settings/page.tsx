'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Role } from '@repo/api';
import { RoleGuard } from '@/components/RoleGuard';
import { SalaryComponentsSettings } from '@/components/settings/SalaryComponentsSettings';
import { AccountingIntegrationsSettings } from '@/components/settings/AccountingIntegrationsSettings';
import { useBranding } from '@/contexts/BrandingContext';
import { getBranding, updateBranding } from '@/lib/branding-api';
import { getMyTenant, type Tenant } from '@/lib/tenants-api';
import { getCountryName } from '@/lib/countries';
import { ApiError } from '@/lib/api-client';
import { FormSkeleton } from '@/components/ui/loading-skeleton';

function SettingsPageContent() {
  const { refreshBranding } = useBranding();
  const searchParams = useSearchParams();
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#111827');
  const [secondaryColor, setSecondaryColor] = useState('#6b7280');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Landed here from the accounting OAuth callback redirect (see
  // AccountingIntegrationsController.callback) — surface the outcome once,
  // then drop the query params so a refresh doesn't re-show the toast.
  useEffect(() => {
    const accounting = searchParams.get('accounting');
    const provider = searchParams.get('provider');
    if (!accounting) return;
    if (accounting === 'connected') {
      toast.success(`Connected to ${provider ?? 'your accounting system'}`);
    } else if (accounting === 'error') {
      toast.error('Could not complete the connection', {
        description: 'The authorization link may have expired — try again.',
      });
    }
    window.history.replaceState(null, '', '/settings');
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const [branding, myTenant] = await Promise.all([
          getBranding(),
          getMyTenant(),
        ]);
        if (cancelled) return;
        setAppName(branding.appName ?? '');
        setLogoUrl(branding.logoUrl ?? '');
        setPrimaryColor(branding.primaryColor ?? '#111827');
        setSecondaryColor(branding.secondaryColor ?? '#6b7280');
        setTenant(myTenant);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof ApiError
              ? err.message
              : 'Failed to load branding settings',
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateBranding({
        appName: appName || undefined,
        logoUrl: logoUrl || undefined,
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
      });
      toast.success('Branding settings saved');
      await refreshBranding();
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Failed to save branding settings',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold">Settings</h1>
          <p className="text-muted-foreground">
            Customize your organization&apos;s branding
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
          </CardHeader>
          <CardContent>
            <FormSkeleton fields={4} />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-red-600 dark:text-red-400">
            Error loading settings: {error}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Settings</h1>
        <p className="text-muted-foreground">
          Customize your organization&apos;s branding
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label>Company name</Label>
            <Input value={tenant?.name ?? ''} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={tenant ? getCountryName(tenant.countryCode) : ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label>Default currency</Label>
              <Input value={tenant?.defaultCurrency ?? ''} disabled />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Country and currency are set when your workspace is created and
            can&apos;t be changed here — they drive statutory tax rules,
            compliance reports, and billing currency throughout the app. Contact
            support if this needs to change.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-w-md">
          <div className="space-y-2">
            <Label htmlFor="appName">App Name</Label>
            <Input
              id="appName"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              placeholder="PayrollFiti"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-14 p-1"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondaryColor">Secondary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="secondaryColor"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-14 p-1"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                />
              </div>
            </div>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      <SalaryComponentsSettings />

      <AccountingIntegrationsSettings />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard allow={[Role.ADMIN]}>
      <Suspense>
        <SettingsPageContent />
      </Suspense>
    </RoleGuard>
  );
}
