'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Role } from '@repo/api';
import { RoleGuard } from '@/components/RoleGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { listAuditLogs, type AuditLogEntry } from '@/lib/audit-logs-api';
import { ApiError } from '@/lib/api-client';
import { PageSkeleton } from '@/components/ui/loading-skeleton';

const PAGE_SIZE = 25;

function DetailsDialog({ entry }: { entry: AuditLogEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        View
      </Button>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">
            {entry.action}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-96 overflow-y-auto text-xs">
          <div>
            <p className="font-medium mb-1">Entity</p>
            <p className="font-mono text-muted-foreground">
              {entry.entityType}:{entry.entityId}
            </p>
          </div>
          {entry.before != null && (
            <div>
              <p className="font-medium mb-1">Before</p>
              <pre className="bg-muted rounded p-2 overflow-x-auto">
                {JSON.stringify(entry.before, null, 2)}
              </pre>
            </div>
          )}
          {entry.after != null && (
            <div>
              <p className="font-medium mb-1">After</p>
              <pre className="bg-muted rounded p-2 overflow-x-auto">
                {JSON.stringify(entry.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AuditLogPageContent() {
  const [page, setPage] = useState(1);
  const [entityTypeInput, setEntityTypeInput] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [filters, setFilters] = useState<{
    entityType?: string;
    action?: string;
  }>({});

  const logsQuery = useQuery({
    queryKey: ['audit-logs', filters, page],
    queryFn: () => listAuditLogs({ ...filters, page, limit: PAGE_SIZE }),
  });

  const applyFilters = () => {
    setPage(1);
    setFilters({
      entityType: entityTypeInput.trim() || undefined,
      action: actionInput.trim() || undefined,
    });
  };

  const totalPages = logsQuery.data
    ? Math.max(1, Math.ceil(logsQuery.data.total / PAGE_SIZE))
    : 1;

  if (logsQuery.isPending) {
    return <PageSkeleton cards={1} rows={8} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Audit Log</h1>
        <p className="text-muted-foreground">
          Every change made in your workspace — who did what, and when
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="entityType">Entity type</Label>
              <Input
                id="entityType"
                placeholder="e.g. employees"
                value={entityTypeInput}
                onChange={(e) => setEntityTypeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="w-48"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="action">Action contains</Label>
              <Input
                id="action"
                placeholder="e.g. invite"
                value={actionInput}
                onChange={(e) => setActionInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                className="w-48"
              />
            </div>
            <Button onClick={applyFilters}>Filter</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {logsQuery.data?.total ?? 0} event
            {logsQuery.data?.total === 1 ? '' : 's'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsQuery.error ? (
            <p className="text-red-600 dark:text-red-400">
              {logsQuery.error instanceof ApiError
                ? logsQuery.error.message
                : 'Failed to load the audit log'}
            </p>
          ) : (logsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-muted-foreground text-sm py-8 text-center">
              No matching events
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logsQuery.data?.items ?? []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(entry.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.actor?.email ?? 'System'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.action}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.entityType}
                      </TableCell>
                      <TableCell className="text-right">
                        <DetailsDialog entry={entry} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuditLogPage() {
  return (
    <RoleGuard allow={[Role.ADMIN]}>
      <AuditLogPageContent />
    </RoleGuard>
  );
}
