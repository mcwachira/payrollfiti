"use client"
import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '@/lib/notifications-api';

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function NotificationRow({
                           notification,
                           onRead,
                         }: {
  notification: Notification;
  onRead: (id: string) => void;
}) {


  return (
    <button
      onClick={() => !notification.read && onRead(notification.id)}
      className="w-full text-left px-3 py-2.5 rounded-md hover:bg-accent flex gap-2.5 items-start"
    >
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
          notification.read ? 'bg-transparent' : 'bg-blue-600'
        }`}
        aria-hidden
      />
      <div className="min-w-0">
        <p
          className={`text-sm ${notification.read ? 'text-muted-foreground' : 'font-medium'}`}
        >
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </button>
  )
}


export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => listNotifications(true),
  });
  const unreadCount = unreadQuery.data?.length ?? 0;

  // Only fetched once the popover is actually opened — the header renders
  // on every page, so the full (read + unread) list shouldn't be a
  // standing request alongside the lightweight unread-count poll above.
  const listQuery = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => listNotifications(false),
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = listQuery.data ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            unreadCount > 0
              ? `Notifications (${unreadCount} unread)`
              : 'Notifications'
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 justify-center text-[10px] bg-red-600 text-white hover:bg-red-600">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-semibold">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-1 text-xs"
            disabled={unreadCount === 0 || markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            Mark all read
          </Button>
        </div>
        <ScrollArea className="h-80">
          <div className="p-1.5">
            {listQuery.isPending ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading…
              </p>
            ) : notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No notifications yet
              </p>
            ) : (
              notifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={(id) => markReadMutation.mutate(id)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
