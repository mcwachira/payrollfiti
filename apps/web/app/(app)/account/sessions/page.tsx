'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { listSessions, revokeSession, revokeOtherSessions } from '@/lib/sessions-api';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function SessionsPage() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      toast.success('Session revoked');
      query.refetch();
    },
    onError: () => {
      toast.error('Could not revoke session');
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => {
      toast.success('Other sessions revoked');
      query.refetch();
    },
    onError: () => {
      toast.error('Could not revoke sessions');
    },
  });

  const sessions = query.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Sessions</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your active sessions.
          </p>
        </div>
        <Button
          variant="noShadow"
          size="sm"
          disabled={revokeOthersMutation.isPending}
          onClick={() => revokeOthersMutation.mutate()}
        >
          {revokeOthersMutation.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Sign out other sessions
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Active Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No active sessions.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>User Agent</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session: any) => (
                    <TableRow key={session.id}>
                      <TableCell className="text-sm">
                        {session.ipAddress ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {session.userAgent ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {session.lastActiveAt
                          ? format(
                              new Date(session.lastActiveAt),
                              'MMM d, HH:mm',
                            )
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="noShadow"
                          disabled={revokeMutation.isPending}
                          onClick={() =>
                            revokeMutation.mutate(session.id)
                          }
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
