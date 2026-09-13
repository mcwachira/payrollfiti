'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, RefreshCw, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  listAccountingConnections,
  createAccountingConnection,
  deleteAccountingConnection,
  listAccountingSyncJobs,
  type AccountingConnection,
  type AccountingSyncJob,
} from '@/lib/settings-api';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/shared-types';
import { RoleGuard } from '@/components/RoleGuard';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<
  string,
  'default' | 'neutral'
> = {
  connected: 'default',
  disconnected: 'neutral',
  error: 'default',
};

const SYNC_COLORS: Record<
  string,
  'default' | 'neutral'
> = {
  pending: 'neutral',
  running: 'neutral',
  completed: 'default',
  failed: 'default',
  pending_external: 'neutral',
};

export default function AccountingConnectionsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['accounting-connections'],
    queryFn: listAccountingConnections,
  });

  const [form, setForm] = useState({
    provider: 'xero' as 'xero' | 'quickbooks' | 'zoho_books',
    name: '',
  });

  const createMutation = useMutation({
    mutationFn: createAccountingConnection,
    onSuccess: () => {
      toast.success('Accounting connection created');
      setOpen(false);
      setForm({ provider: 'xero', name: '' });
      query.refetch();
    },
    onError: (error) => {
      toast.error('Could not create connection', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccountingConnection,
    onSuccess: () => {
      toast.success('Connection deleted');
      query.refetch();
      setSelectedId(null);
    },
    onError: (error) => {
      toast.error('Could not delete connection', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      provider: form.provider,
      name: form.name,
    });
  };

  const selectedConnection = query.data?.find(
    (c) => c.id === (selectedId ?? ''),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Accounting Integrations
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Connect accounting platforms.
          </p>
        </div>
        <RoleGuard allow={[Role.ADMIN]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Connection
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Connection</DialogTitle>
                <DialogDescription>
                  Connect a new accounting platform.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={form.provider}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        provider: v as
                          | 'xero'
                          | 'quickbooks'
                          | 'zoho_books',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="xero">Xero</SelectItem>
                      <SelectItem value="quickbooks">
                        QuickBooks
                      </SelectItem>
                      <SelectItem value="zoho_books">
                        Zoho Books
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ ...form, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="neutral"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          {query.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : query.data && query.data.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.map(
                    (conn: AccountingConnection) => (
                      <TableRow key={conn.id}>
                        <TableCell className="text-sm capitalize">
                          {conn.provider.replace('_', ' ')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {conn.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_COLORS[conn.status] ?? 'outline'
                            }
                          >
                            {conn.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {conn.lastSyncAt
                            ? format(
                                new Date(conn.lastSyncAt),
                                'MMM d, yyyy',
                              )
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="noShadow"
                              onClick={() =>
                                setSelectedId(
                                  selectedId === conn.id
                                    ? null
                                    : conn.id,
                                )
                              }
                            >
                              {selectedId === conn.id
                                ? 'Hide Jobs'
                                : 'Jobs'}
                            </Button>
                            <Button
                              size="icon"
                              variant="noShadow"
                              onClick={() =>
                                deleteMutation.mutate(conn.id)
                              }
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ),
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No accounting connections configured.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedConnection && selectedId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Sync Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AccountingJobs connectionId={selectedId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AccountingJobs({ connectionId }: { connectionId: string }) {
  const jobsQuery = useQuery({
    queryKey: ['accounting-jobs', connectionId],
    queryFn: () => listAccountingSyncJobs(connectionId),
    enabled: !!connectionId,
  });

  if (jobsQuery.isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!jobsQuery.data || jobsQuery.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No jobs yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Finished</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobsQuery.data.map((job: AccountingSyncJob) => (
            <TableRow key={job.id}>
              <TableCell>
                <Badge
                  variant={
                    SYNC_COLORS[job.status] ?? 'outline'
                  }
                >
                  {job.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm">
                {job.startedAt
                  ? format(new Date(job.startedAt), 'MMM d, HH:mm')
                  : '—'}
              </TableCell>
              <TableCell className="text-sm">
                {job.finishedAt
                  ? format(new Date(job.finishedAt), 'MMM d, HH:mm')
                  : '—'}
              </TableCell>
              <TableCell className="text-sm">
                {job.errorMessage ?? '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
