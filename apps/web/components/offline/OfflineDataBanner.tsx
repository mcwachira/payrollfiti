import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Shown wherever a view is displaying an IndexedDB-cached copy of data because the live fetch failed. */
export function OfflineDataBanner({ cachedAt }: { cachedAt?: number }) {
  return (
    <Alert>
      <WifiOff />
      <AlertTitle>You&apos;re offline</AlertTitle>
      <AlertDescription>
        Showing saved data
        {cachedAt ? ` from ${new Date(cachedAt).toLocaleString()}` : ''}. It
        will refresh automatically once you&apos;re back online.
      </AlertDescription>
    </Alert>
  );
}
