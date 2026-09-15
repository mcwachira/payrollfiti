'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Laptop, LogOut } from 'lucide-react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { listSessions, revokeSession, type Session } from '@/lib/sessions-api';
import { ApiError } from '@/lib/api-client';
import { useAuth } from '@/contexts/AuthContext';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

/** Lightweight heuristic parse — good enough for "which device is this",
 *  not meant to be a full user-agent parsing library. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Mac OS X/.test(userAgent)
      ? 'macOS'
      : /Android/.test(userAgent)
        ? 'Android'
        : /iPhone|iPad/.test(userAgent)
          ? 'iOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : '';
  return os ? `${browser} on ${os}` : browser;
}

function SessionRow({ session }: { session: Session }) {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const revokeMutation = useMutation({
    mutationFn: () => revokeSession(session.id),
    onSuccess: async () => {
      if (session.isCurrent) {
        // The revoked session backed this very device's refresh token —
        // finish the job locally too instead of leaving a signed-out-on-
        // the-server-but-not-in-the-UI page up.
        await logout();
        return;
      }
      toast.success('Signed out');
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
    onError: (error) => {
      toast.error('Could not sign out that device', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <Laptop className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {describeDevice(session.userAgent)}
            </span>
            {session.isCurrent && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400">
                This device
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {session.ipAddress ?? 'Unknown location'} · Last active{' '}
            {new Date(session.lastUsedAt).toLocaleString()}
          </p>
        </div>
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={revokeMutation.isPending}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Sign out
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sign out {session.isCurrent ? 'this device' : 'that device'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {session.isCurrent
                ? "You'll be signed out immediately."
                : "That device won't be able to use the app until it signs in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => revokeMutation.mutate()}>
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SessionsSettings() {
  const sessionsQuery = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Signed-In Devices</CardTitle>
        <CardDescription>
          Everywhere you&apos;re currently signed in — sign out devices you
          don&apos;t recognize
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sessionsQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : sessionsQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errorMessage(sessionsQuery.error, 'Failed to load sessions')}
          </p>
        ) : (
          <div className="space-y-2">
            {(sessionsQuery.data ?? []).map((session) => (
              <SessionRow key={session.id} session={session} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
