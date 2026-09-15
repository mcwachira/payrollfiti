'use client';
import { Bell, BellOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/lib/push/use-push-notifications';

/** Hidden entirely on browsers without Push API support (e.g. iOS Safari < 16.4). */
export function PushNotificationToggle() {
  const { support, subscribed, busy, subscribe, unsubscribe } =
    usePushNotifications();

  if (support !== 'ready') return null;

  const handleClick = async () => {
    try {
      if (subscribed) {
        await unsubscribe();
        toast.success('Notifications turned off');
      } else {
        await subscribe();
        toast.success('Notifications enabled');
      }
    } catch (error) {
      toast.error('Could not update notification settings', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={busy}
      onClick={handleClick}
      aria-label={
        subscribed ? 'Turn off notifications' : 'Enable notifications'
      }
      title={subscribed ? 'Turn off notifications' : 'Enable notifications'}
    >
      {subscribed ? (
        <Bell className="h-4 w-4" />
      ) : (
        <BellOff className="h-4 w-4" />
      )}
    </Button>
  );
}
