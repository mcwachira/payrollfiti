import { APP_NAME } from '@/lib/config';

export const metadata = {
  title: `You're offline — ${APP_NAME}`,
};

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-muted-foreground">
        This page isn&apos;t available without a connection. Reconnect and
        try again — pages and payslips you&apos;ve already opened may still
        work.
      </p>
    </div>
  );
}
