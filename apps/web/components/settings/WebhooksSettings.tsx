'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, ListTree, Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  WEBHOOK_EVENTS,
  type WebhookEndpoint,
} from '@/lib/webhooks-api';
import { ApiError } from '@/lib/api-client';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function CreateWebhookDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: createWebhook,
    onSuccess: () => {
      toast.success('Webhook created');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setOpen(false);
      setUrl('');
      setEvents([]);
    },
    onError: (error) => {
      toast.error('Could not create the webhook', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  const toggleEvent = (event: string, checked: boolean) => {
    setEvents((prev) =>
      checked ? [...prev, event] : prev.filter((e) => e !== event),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New webhook
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create webhook</DialogTitle>
          <DialogDescription>
            We&apos;ll POST a signed payload to this URL whenever one of the
            selected events happens.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Endpoint URL</Label>
            <Input
              id="webhook-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/payrollfiti"
            />
          </div>
          <div className="space-y-2">
            <Label>Events</Label>
            {WEBHOOK_EVENTS.map((event) => (
              <div key={event} className="flex items-center gap-2">
                <Checkbox
                  id={`event-${event}`}
                  checked={events.includes(event)}
                  onCheckedChange={(checked) =>
                    toggleEvent(event, checked === true)
                  }
                />
                <Label
                  htmlFor={`event-${event}`}
                  className="font-mono text-sm font-normal"
                >
                  {event}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={
              !url.trim() || events.length === 0 || createMutation.isPending
            }
            onClick={() => createMutation.mutate({ url: url.trim(), events })}
          >
            {createMutation.isPending ? 'Creating…' : 'Create webhook'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeliveriesDialog({ webhook }: { webhook: WebhookEndpoint }) {
  const [open, setOpen] = useState(false);
  const deliveriesQuery = useQuery({
    queryKey: ['webhook-deliveries', webhook.id],
    queryFn: () => listWebhookDeliveries(webhook.id),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ListTree className="h-3.5 w-3.5 mr-1.5" />
          Deliveries
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Recent deliveries</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {webhook.url}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2">
          {deliveriesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (deliveriesQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No deliveries yet
            </p>
          ) : (
            (deliveriesQuery.data ?? []).map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-start gap-2 p-2.5 border rounded-md text-sm"
              >
                {delivery.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-mono text-xs">{delivery.event}</p>
                  <p className="text-xs text-muted-foreground">
                    {delivery.statusCode ?? 'no response'} ·{' '}
                    {new Date(delivery.createdAt).toLocaleString()}
                  </p>
                  {delivery.error && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      {delivery.error}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WebhooksSettings() {
  const queryClient = useQueryClient();
  const webhooksQuery = useQuery({
    queryKey: ['webhooks'],
    queryFn: listWebhooks,
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateWebhook(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (error) => {
      toast.error('Could not update the webhook', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWebhook,
    onSuccess: () => {
      toast.success('Webhook deleted');
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
    },
    onError: (error) => {
      toast.error('Could not delete the webhook', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Webhooks</CardTitle>
          <CardDescription>
            Get notified in your own systems when payroll runs complete or
            invoices are paid
          </CardDescription>
        </div>
        <CreateWebhookDialog />
      </CardHeader>
      <CardContent>
        {webhooksQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : webhooksQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errorMessage(webhooksQuery.error, 'Failed to load webhooks')}
          </p>
        ) : (webhooksQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No webhooks configured yet
          </p>
        ) : (
          <div className="space-y-3">
            {(webhooksQuery.data ?? []).map((webhook) => (
              <div key={webhook.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm break-all">{webhook.url}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {webhook.secret}
                    </p>
                  </div>
                  <Switch
                    checked={webhook.isActive}
                    onCheckedChange={(checked) =>
                      toggleActiveMutation.mutate({
                        id: webhook.id,
                        isActive: checked,
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {webhook.events.map((event) => (
                    <Badge
                      key={event}
                      variant="outline"
                      className="font-mono text-xs"
                    >
                      {event}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <DeliveriesDialog webhook={webhook} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Delete this webhook?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Events will stop being delivered to {webhook.url}{' '}
                          immediately. This can&apos;t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate(webhook.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
