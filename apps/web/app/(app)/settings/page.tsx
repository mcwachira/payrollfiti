'use client';
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Role } from '@repo/api';
import { RoleGuard } from '@/components/RoleGuard';
import { useBranding } from '@/contexts/BrandingContext';
import { getBranding, updateBranding } from '@/lib/branding-api';
import { ApiError } from '@/lib/api-client';
import { FormSkeleton } from '@/components/ui/loading-skeleton';

function SettingsPageContent() {
  const { refreshBranding } = useBranding();
  const [appName, setAppName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#111827');
  const [secondaryColor, setSecondaryColor] = useState('#6b7280');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const branding = await getBranding();
        if (cancelled) return;
        setAppName(branding.appName ?? '');
        setLogoUrl(branding.logoUrl ?? '');
        setPrimaryColor(branding.primaryColor ?? '#111827');
        setSecondaryColor(branding.secondaryColor ?? '#6b7280');
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
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RoleGuard allow={[Role.ADMIN]}>
      <SettingsPageContent />
    </RoleGuard>
  );
}
