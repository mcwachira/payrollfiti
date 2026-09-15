'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/shared-types';
import { RoleGuard } from '@/components/RoleGuard';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  listAuditLogs,
  type AuditLog,
} from '@/lib/settings-api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';

export default function AuditLogsPage() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['audit-logs'],
    queryFn: listAuditLogs,
  });

  const logs = query.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Audit Logs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          System activity trail.
        </p>
      </div>

      <RoleGuard allow={[Role.ADMIN]}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {query.isPending ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No audit logs found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Action</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>IP</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: AuditLog) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {log.action}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.auditableType}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.ipAddress ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(
                            new Date(log.createdAt),
                            'MMM d, yyyy HH:mm',
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </RoleGuard>
    </div>
  );
}
