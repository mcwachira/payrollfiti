'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  listAccountingIntegrations,
  getAccountingConnectUrl,
  disconnectAccountingIntegration,
  type AccountingProviderId,
} from '@/lib/accounting-api';
import { ApiError } from '@/lib/api-client';

const PROVIDER_LABELS: Record<AccountingProviderId, string> = {
  QUICKBOOKS: 'QuickBooks',
  XERO: 'Xero',
  ZOHO_BOOKS: 'Zoho Books',
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function AccountingIntegrationsSettings() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ['accounting-integrations'],
    queryFn: listAccountingIntegrations,
  });

  const connectMutation = useMutation({
    mutationFn: getAccountingConnectUrl,
    onSuccess: (authorizeUrl) => {
      // Full-page navigation, not a popup — this is a standard OAuth
      // consent redirect, and the platform's own callback lands the
      // browser back on /settings when it's done (see
      // AccountingIntegrationsController.callback).
      window.location.href = authorizeUrl;
    },
    onError: (error) => {
      toast.error('Could not start the connection', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectAccountingIntegration,
    onSuccess: () => {
      toast.success('Disconnected');
      queryClient.invalidateQueries({ queryKey: ['accounting-integrations'] });
    },
    onError: (error) => {
      toast.error('Could not disconnect', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounting</CardTitle>
        <CardDescription>
          Sync subscription payments and payroll runs to your accounting system
          automatically
        </CardDescription>
      </CardHeader>
      <CardContent>
        {statusQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : statusQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errorMessage(
              statusQuery.error,
              'Failed to load accounting integrations',
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {(statusQuery.data ?? []).map((status) => (
              <div
                key={status.provider}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {PROVIDER_LABELS[status.provider]}
                    </span>
                    {status.connected && (
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                    {!status.configured && (
                      <Badge variant="outline">Not available</Badge>
                    )}
                  </div>
                  {status.connected && status.connectedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connected{' '}
                      {new Date(status.connectedAt).toLocaleDateString()}
                    </p>
                  )}
                  {!status.configured && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      This server hasn&apos;t been set up with{' '}
                      {PROVIDER_LABELS[status.provider]} credentials yet.
                    </p>
                  )}
                </div>
                {status.connected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={disconnectMutation.isPending}
                    onClick={() => disconnectMutation.mutate(status.provider)}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!status.configured || connectMutation.isPending}
                    onClick={() => connectMutation.mutate(status.provider)}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
