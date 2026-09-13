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
  listWebhookEndpoints,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  listWebhookDeliveryLogs,
  type WebhookEndpoint,
  type WebhookDeliveryLog,
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
  active: 'default',
  paused: 'neutral',
};

export default function WebhookEndpointsPage() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['webhook-endpoints'],
    queryFn: listWebhookEndpoints,
  });

  const [form, setForm] = useState({
    url: '',
    events: '',
    secret: '',
  });

  const createMutation = useMutation({
    mutationFn: createWebhookEndpoint,
    onSuccess: () => {
      toast.success('Webhook endpoint created');
      setOpen(false);
      setForm({ url: '', events: '', secret: '' });
      query.refetch();
    },
    onError: (error) => {
      toast.error('Could not create webhook endpoint', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhookEndpoint,
    onSuccess: () => {
      toast.success('Webhook endpoint deleted');
      query.refetch();
      setSelectedId(null);
    },
    onError: (error) => {
      toast.error('Could not delete webhook endpoint', {
        description: error instanceof ApiError ? error.message : undefined,
      });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      url: form.url,
      events: form.events.split(',').map((e) => e.trim()),
      secret: form.secret,
    });
  };

  const selectedEndpoint = query.data?.find((e) => e.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">
            Webhook Endpoints
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure outbound webhooks.
          </p>
        </div>
        <RoleGuard allow={[Role.ADMIN]}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> New Endpoint
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Webhook Endpoint</DialogTitle>
                <DialogDescription>
                  Add a new webhook endpoint.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={form.url}
                    onChange={(e) =>
                      setForm({ ...form, url: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="events">Events (comma-separated)</Label>
                  <Input
                    id="events"
                    value={form.events}
                    onChange={(e) =>
                      setForm({ ...form, events: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret">Secret</Label>
                  <Input
                    id="secret"
                    value={form.secret}
                    onChange={(e) =>
                      setForm({ ...form, secret: e.target.value })
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
            Endpoints
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
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.map((endpoint: WebhookEndpoint) => (
                    <TableRow key={endpoint.id}>
                      <TableCell className="text-sm">
                        {endpoint.url}
                      </TableCell>
                      <TableCell className="text-sm">
                        {endpoint.events.join(', ')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            STATUS_COLORS[endpoint.status] ?? 'outline'
                          }
                        >
                          {endpoint.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="noShadow"
                              onClick={() =>
                                setSelectedId(
                                  selectedId === endpoint.id
                                    ? null
                                    : endpoint.id,
                                )
                              }
                            >
                              {selectedId === endpoint.id
                                ? 'Hide Logs'
                                : 'Logs'}
                            </Button>
                            <Button
                              size="icon"
                              variant="noShadow"
                              onClick={() =>
                                deleteMutation.mutate(endpoint.id)
                              }
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No webhook endpoints configured.
            </p>
          )}
        </CardContent>
      </Card>

      {selectedEndpoint && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">
              Delivery Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WebhookLogs endpointId={selectedId} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function WebhookLogs({ endpointId }: { endpointId: string | null }) {
  const logsQuery = useQuery({
    queryKey: ['webhook-logs', endpointId],
    queryFn: () => listWebhookDeliveryLogs(endpointId!),
    enabled: !!endpointId,
  });

  if (logsQuery.isPending) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!logsQuery.data || logsQuery.data.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No logs yet.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Delivered</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logsQuery.data.map((log: WebhookDeliveryLog) => (
            <TableRow key={log.id}>
              <TableCell className="text-sm">{log.eventType}</TableCell>
              <TableCell className="text-sm">
                {log.statusCode ?? '—'}
              </TableCell>
              <TableCell className="text-sm">
                {log.attempts}
              </TableCell>
              <TableCell className="text-sm">
                {log.deliveredAt
                  ? format(new Date(log.deliveredAt), 'MMM d, HH:mm')
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
