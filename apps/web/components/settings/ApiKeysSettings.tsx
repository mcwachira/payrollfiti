'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, Key, Plus } from 'lucide-react';
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
import { listApiKeys, createApiKey, revokeApiKey } from '@/lib/api-keys-api';
import { ApiError } from '@/lib/api-client';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function ApiKeysSettings() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  // Shown once, immediately after creation — never retrievable again, so
  // this lives only in local state, not in any query cache.
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const keysQuery = useQuery({ queryKey: ['api-keys'], queryFn: listApiKeys });

  const createMutation = useMutation({
    mutationFn: createApiKey,
    onSuccess: ({ rawKey }) => {
      setRevealedKey(rawKey);
      setCreateOpen(false);
      setNewKeyName('');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => {
      toast.error('Could not create the API key', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeApiKey,
    onSuccess: () => {
      toast.success('API key revoked');
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
    },
    onError: (error) => {
      toast.error('Could not revoke the API key', {
        description: errorMessage(error, 'Please try again'),
      });
    },
  });

  const copyRevealedKey = async () => {
    if (!revealedKey) return;
    await navigator.clipboard.writeText(revealedKey);
    toast.success('Copied to clipboard');
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>
            Machine credentials for the read-only public API
          </CardDescription>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Give it a name that identifies where it&apos;ll be used — e.g.
                &quot;Accounting export script&quot;.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="key-name">Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g. Accounting export script"
              />
            </div>
            <DialogFooter>
              <Button
                disabled={!newKeyName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate(newKeyName.trim())}
              >
                {createMutation.isPending ? 'Creating…' : 'Create key'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {revealedKey && (
          <div className="mb-4 p-3 border-2 border-amber-400 dark:border-amber-600 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <p className="text-sm font-medium mb-2">
              Copy this key now — you won&apos;t be able to see it again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border rounded px-2 py-1.5 overflow-x-auto">
                {revealedKey}
              </code>
              <Button size="sm" variant="outline" onClick={copyRevealedKey}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2"
              onClick={() => setRevealedKey(null)}
            >
              I&apos;ve copied it
            </Button>
          </div>
        )}

        {keysQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : keysQuery.error ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errorMessage(keysQuery.error, 'Failed to load API keys')}
          </p>
        ) : (keysQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No API keys yet
          </p>
        ) : (
          <div className="space-y-2">
            {(keysQuery.data ?? []).map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      {key.revokedAt && (
                        <Badge
                          variant="outline"
                          className="text-muted-foreground"
                        >
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {key.keyPrefix}…
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsedAt &&
                        ` · Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>
                {!key.revokedAt && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        Revoke
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Revoke &quot;{key.name}&quot;?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Any script or integration using this key will stop
                          working immediately. This can&apos;t be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => revokeMutation.mutate(key.id)}
                        >
                          Revoke
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
