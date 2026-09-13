'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2 } from 'lucide-react';
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
  listApiKeys,
  createApiKey,
  deleteApiKey,
  type ApiKey,
  type ApiKeyCreateResponse,
} from '@/lib/settings-api';
import { useAuth } from '@/contexts/AuthContext';
import { Role } from '@/shared-types';
import { RoleGuard } from '@/components/RoleGuard';
import { ApiError } from '@/lib/api-client';
import { toast } from 'sonner';

const STATUS_COLORS: Record<
  string,
  'default' | 'neutral'
> = {
  active: 'default',
  revoked: 'neutral',
  expired: 'neutral',
};

export default function ApiKeysPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [createdKey, setCreatedKey] =
    useState<ApiKeyCreateResponse | null>(null);

  const query = useQuery({
    queryKey: ['api-keys'],
    queryFn: listApiKeys,
  });

  const [form, setForm] = useState({ name: '' });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: (data) => {
      toast.success('API key created');
      setCreatedKey(data);
      setOpen(false);
      setForm({ name: '' });
      query.refetch();
    },
    onError: (error) => {
      toast.error('Could not create API key', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteApiKey,
    onSuccess: () => {
      toast.success('API key deleted');
      query.refetch();
    },
    onError: (error) => {
      toast.error('Could not delete API key', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name: form.name });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">API Keys</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage API keys for programmatic access.
          </p>
        </div>
        <RoleGuard allow={[Role.ADMIN]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New API Key</DialogTitle>
                <DialogDescription>
                  Create a new API key. The secret will be shown only once.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) =>
                      setForm({ name: e.target.value })
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

      {createdKey && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Save this secret
            </CardTitle>
            <CardDescription>
              You won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block rounded bg-muted p-2 text-xs break-all">
              {createdKey.plainSecret}
            </code>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            API Keys
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
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Used</TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.map((key: ApiKey) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        {key.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {key.prefix}...
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_COLORS[key.status] ?? 'outline'
                          }
                        >
                          {key.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {key.lastUsedAt
                          ? new Date(key.lastUsedAt).toLocaleString()
                          : 'Never'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="noShadow"
                          onClick={() => deleteMutation.mutate(key.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No API keys created yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
